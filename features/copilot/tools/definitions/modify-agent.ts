import { z } from "zod";
import { DEFAULT_GROQ_MODEL } from "@/lib/llm/models";
import { getProvider } from "@/lib/llm/provider";
import { getAgentDetail, updateAgent, type AgentGraphPayload } from "@/lib/repos/agents";
import { describeNodeTypesForPrompt } from "@/features/agents/generation/generate-from-description";
import { arePortTypesCompatible } from "@/features/agents/lib/port-types";
import { createNode, generateEdgeId, getNodeType } from "@/features/agents/nodes/registry";
import type { DiffableEdge, DiffableGraph, DiffableNode } from "@/features/agents/versions/diff";
import type { ToolCommitResult, ToolDefinition } from "../types";

const inputSchema = z.object({
  agentId: z.string().min(1),
  instruction: z.string().min(1).max(1000),
});
type Input = z.infer<typeof inputSchema>;

interface PreviewData {
  base: DiffableGraph;
  compare: DiffableGraph;
  changedCount: number;
}

interface CommitPayload {
  agentId: string;
  nextGraph: AgentGraphPayload;
}

const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("update_node"), nodeId: z.string(), label: z.string().optional(), config: z.record(z.string(), z.unknown()).optional() }),
  z.object({ op: z.literal("remove_node"), nodeId: z.string() }),
  z.object({ op: z.literal("add_node"), type: z.string(), label: z.string(), config: z.record(z.string(), z.unknown()).optional() }),
]);
const planSchema = z.object({ operations: z.array(operationSchema).min(1).max(5) });
type Operation = z.infer<typeof operationSchema>;

function toDiffableGraph(graph: AgentGraphPayload): DiffableGraph {
  return { nodes: graph.nodes as DiffableNode[], edges: graph.edges as DiffableEdge[] };
}

function buildSystemPrompt(graph: DiffableGraph): string {
  const nodeLines = graph.nodes
    .map((node) => `- id="${node.id}" type="${node.type}" label="${node.data.label}" config=${JSON.stringify(node.data.config)}`)
    .join("\n");
  const edgeLines = graph.edges.map((edge) => `- ${edge.source} -> ${edge.target}`).join("\n") || "(none)";

  return [
    `You modify an existing automation agent graph for KILN. You are given the current graph and a plain-English instruction, and must respond with a small list of operations to apply.`,
    ``,
    `Available node types -- use only these "type" values when adding a node:`,
    describeNodeTypesForPrompt(),
    ``,
    `Current nodes:`,
    nodeLines || "(none)",
    `Current connections:`,
    edgeLines,
    ``,
    `Respond with a JSON object exactly matching this shape, and nothing else:`,
    `{"operations": [{"op": "update_node", "nodeId": string, "label": string, "config": object} | {"op": "remove_node", "nodeId": string} | {"op": "add_node", "type": string, "label": string, "config": object}]}`,
    ``,
    `Rules:`,
    `- "nodeId" must be copied verbatim from an id listed above.`,
    `- "update_node"/"add_node" "config" should only set fields that node type actually has; omit fields you have no opinion on.`,
    `- Prefer the smallest set of operations that satisfies the instruction -- at most 5.`,
    `- Respond with JSON only -- no prose, no markdown fences.`,
  ].join("\n");
}

/** Applies operations to a copy of `graph`, mutating nothing on the input.
 *  Every operation is best-effort: one referencing a nonexistent node is
 *  silently skipped rather than failing the whole proposal, since a partial,
 *  honest result beats discarding an otherwise-reasonable set of changes
 *  over one bad reference. */
function applyOperations(graph: DiffableGraph, operations: Operation[]): DiffableGraph {
  let nodes = graph.nodes.map((node) => ({ ...node, data: { label: node.data.label, config: { ...node.data.config } } }));
  let edges = graph.edges.map((edge) => ({ ...edge }));

  for (const operation of operations) {
    if (operation.op === "update_node") {
      const node = nodes.find((candidate) => candidate.id === operation.nodeId);
      if (!node) continue;
      const definition = getNodeType(node.type);
      if (!definition) continue;
      const nextLabel = operation.label ?? node.data.label;
      const mergedConfig = { ...node.data.config, ...operation.config };
      const validated = definition.configSchema.safeParse(mergedConfig);
      node.data = { label: nextLabel, config: validated.success ? validated.data : node.data.config };
      continue;
    }

    if (operation.op === "remove_node") {
      const removedId = operation.nodeId;
      if (!nodes.some((node) => node.id === removedId)) continue;
      const incoming = edges.filter((edge) => edge.target === removedId);
      const outgoing = edges.filter((edge) => edge.source === removedId);
      edges = edges.filter((edge) => edge.source !== removedId && edge.target !== removedId);

      // A simple pass-through (exactly one predecessor, one successor):
      // reconnect around the gap so the chain still runs end to end,
      // bridging if the two ports don't directly match.
      if (incoming.length === 1 && outgoing.length === 1) {
        const predecessor = nodes.find((node) => node.id === incoming[0]!.source);
        const successor = nodes.find((node) => node.id === outgoing[0]!.target);
        const predecessorDef = predecessor ? getNodeType(predecessor.type) : undefined;
        const successorDef = successor ? getNodeType(successor.type) : undefined;
        const sourcePort = predecessorDef?.outputs.find((port) => port.id === incoming[0]!.sourceHandle);
        const targetPort = successorDef?.inputs.find((port) => port.id === outgoing[0]!.targetHandle);
        if (predecessor && successor && sourcePort && targetPort) {
          if (arePortTypesCompatible(sourcePort.type, targetPort.type)) {
            edges.push({ id: generateEdgeId(), source: predecessor.id, sourceHandle: sourcePort.id, target: successor.id, targetHandle: targetPort.id });
          } else {
            const bridgeDefinition = getNodeType("transform")!;
            const bridge = createNode("transform", { x: 0, y: 0 }, { label: "Bridge" });
            nodes.push(bridge as unknown as DiffableNode);
            edges.push({ id: generateEdgeId(), source: predecessor.id, sourceHandle: sourcePort.id, target: bridge.id, targetHandle: bridgeDefinition.inputs[0]!.id });
            edges.push({ id: generateEdgeId(), source: bridge.id, sourceHandle: bridgeDefinition.outputs[0]!.id, target: successor.id, targetHandle: targetPort.id });
          }
        }
      }

      nodes = nodes.filter((node) => node.id !== removedId);
      continue;
    }

    // add_node
    const definition = getNodeType(operation.type);
    if (!definition) continue;
    const configResult = definition.configSchema.safeParse({ ...definition.defaultConfig, ...operation.config });
    const created = createNode(operation.type, { x: 0, y: 0 }, {
      label: operation.label,
      config: configResult.success ? configResult.data : definition.defaultConfig,
    });

    const tail = nodes.find((node) => !edges.some((edge) => edge.source === node.id));
    if (tail) {
      const tailDefinition = getNodeType(tail.type);
      const sourcePort = tailDefinition?.outputs[0];
      const targetPort = definition.inputs[0];
      if (sourcePort && targetPort) {
        if (arePortTypesCompatible(sourcePort.type, targetPort.type)) {
          edges.push({ id: generateEdgeId(), source: tail.id, sourceHandle: sourcePort.id, target: created.id, targetHandle: targetPort.id });
        } else {
          const bridgeDefinition = getNodeType("transform")!;
          const bridge = createNode("transform", { x: 0, y: 0 }, { label: "Bridge" });
          nodes.push(bridge as unknown as DiffableNode);
          edges.push({ id: generateEdgeId(), source: tail.id, sourceHandle: sourcePort.id, target: bridge.id, targetHandle: bridgeDefinition.inputs[0]!.id });
          edges.push({ id: generateEdgeId(), source: bridge.id, sourceHandle: bridgeDefinition.outputs[0]!.id, target: created.id, targetHandle: targetPort.id });
        }
      }
    }
    nodes.push(created as unknown as DiffableNode);
  }

  // Positions are cosmetic for the diff preview only -- laid out fresh in a
  // single row so a newly added / bridge node doesn't land at (0,0) on top
  // of another. The committed graph keeps these; a person can still drag
  // nodes apart in the builder afterward, same as any other edit there.
  nodes = nodes.map((node, index) => ({ ...node, position: { x: index * 220, y: 120 } }));

  return { nodes, edges };
}

/**
 * "Proposes graph changes, previews as a canvas diff" (spec item 2). Unlike
 * `create_agent_from_description`, this can't just re-derive a graph from
 * scratch -- an existing agent's node ids, positions, and unrelated config
 * have to survive untouched, so the model's job here is a short list of
 * *operations* (update/remove/add one node at a time), applied
 * deterministically by `applyOperations` above, never a full graph rewrite.
 */
export const modifyAgentTool: ToolDefinition<Input, PreviewData, CommitPayload> = {
  name: "modify_agent",
  description:
    "Proposes changes to an existing agent's node graph -- updating a node's config or label, adding a node, or removing one. Use this when the user asks to change, update, fix, or adjust an existing agent. Does not save anything -- the user must approve the proposed diff first.",
  inputSchema,
  parameters: {
    type: "object",
    properties: {
      agentId: { type: "string", description: "The agent's id." },
      instruction: { type: "string", description: "What to change, in the user's own words." },
    },
    required: ["agentId", "instruction"],
  },
  requiredRole: "member",
  mutates: true,
  async run(input, ctx) {
    const agent = await getAgentDetail(ctx.workspaceId, input.agentId);
    if (!agent) throw new Error("No agent with that id exists in this workspace.");
    const current = toDiffableGraph(agent.graph ?? { nodes: [], edges: [] });

    const response = await getProvider().complete({
      model: DEFAULT_GROQ_MODEL,
      messages: [
        { role: "system", content: buildSystemPrompt(current) },
        { role: "user", content: input.instruction },
      ],
      temperature: 0.3,
      responseFormat: "json",
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.content);
    } catch {
      throw new Error("The model didn't return a usable set of changes. Try rephrasing the instruction.");
    }
    const plan = planSchema.safeParse(parsed);
    if (!plan.success) {
      throw new Error("The model's proposed changes were malformed. Try rephrasing the instruction.");
    }

    const next = applyOperations(current, plan.data.operations);
    const changedCount = plan.data.operations.length;

    return {
      preview: {
        kind: "diff",
        summary: `Update ${agent.name} (${changedCount} change${changedCount === 1 ? "" : "s"})`,
        data: { base: current, compare: next, changedCount },
      },
      commitPayload: { agentId: agent.id, nextGraph: { nodes: next.nodes, edges: next.edges } },
    };
  },
  async commit(payload, _input, ctx): Promise<ToolCommitResult> {
    const previous = await getAgentDetail(ctx.workspaceId, payload.agentId);
    if (!previous) throw new Error("This agent no longer exists.");

    await updateAgent(ctx.workspaceId, payload.agentId, { graph: payload.nextGraph });
    return {
      summary: `Updated ${previous.name}`,
      href: `/w/${ctx.workspaceSlug}/agents/${payload.agentId}/build`,
      undo: {
        kind: "restore_agent_graph",
        payload: {
          agentId: payload.agentId,
          workspaceSlug: ctx.workspaceSlug,
          previousGraph: previous.graph ?? { nodes: [], edges: [] },
          nextGraph: payload.nextGraph,
        },
      },
    };
  },
};
