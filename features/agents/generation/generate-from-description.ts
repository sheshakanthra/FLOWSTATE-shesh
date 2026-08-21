import { z } from "zod";
import { getProvider } from "@/lib/llm/provider";
import { STRUCTURED_GENERATION_MODEL } from "@/lib/llm/models";
import { arePortTypesCompatible } from "../lib/port-types";
import { validateGraph, type ValidationIssue } from "../lib/validate-graph";
import { createNode, generateEdgeId, getNodeType, listNodeTypes, type AgentNode } from "../nodes/registry";
import { LLM_CALL_RETRY_POLICY, withRetry } from "../engine/retry";

/**
 * C3's demo moment, and the thing E1 (marketing hero) reuses verbatim per
 * the spec's own Notes -- so this lives under features/agents/ (an agent-
 * graph concern, not a copilot one), not under features/copilot/tools/,
 * even though the only caller in this session is
 * features/copilot/tools/definitions/create-agent.ts.
 *
 * Two-phase, deliberately: the LLM's only job is choosing *which* node types
 * to use, in what order, with what human-facing text (label, system prompt,
 * condition wording, ...) -- a small, low-risk JSON completion. Every id,
 * position, edge, and port wiring is then assembled in plain code from
 * `features/agents/nodes/registry.ts`'s own factories, exactly the way a
 * template (features/agents/templates/definitions/) is hand-built. This is
 * what makes the result *guaranteed* structurally valid regardless of what
 * Llama proposes -- no reliance on the model getting a node id, a port id,
 * or a config field name right.
 */

const stepSchema = z.object({
  type: z.string(),
  label: z.string().min(1).max(80),
  config: z.record(z.string(), z.unknown()).optional(),
});

const planSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(400),
  steps: z.array(stepSchema).min(1).max(8),
});

export type GeneratedStep = z.infer<typeof stepSchema>;
export type GeneratedPlan = z.infer<typeof planSchema>;

export interface GeneratedAgent {
  name: string;
  description: string;
  graph: { nodes: AgentNode[]; edges: { id: string; source: string; sourceHandle: string; target: string; targetHandle: string }[] };
  issues: ValidationIssue[];
}

const X_SPACING = 220;
const Y_POSITION = 120;

/** Shared with features/copilot/tools/definitions/modify-agent.ts, whose
 *  own prompt needs the same registry description -- one place describing
 *  "what node types exist" to an LLM, so the two never drift apart. */
export function describeNodeTypesForPrompt(): string {
  return listNodeTypes()
    .map((definition) => {
      const inputs = definition.inputs.map((port) => `${port.id}:${port.type}`).join(", ") || "none";
      const outputs = definition.outputs.map((port) => `${port.id}:${port.type}`).join(", ") || "none";
      const configFields = Object.keys(definition.defaultConfig).join(", ") || "none";
      return `- "${definition.id}" (${definition.label}): ${definition.description} Inputs: ${inputs}. Outputs: ${outputs}. Config fields: ${configFields}.`;
    })
    .join("\n");
}

function buildSystemPrompt(): string {
  return [
    `You design automation agent graphs for KILN, an AI automation agency's operating system. Given a plain-English description of what an agent should do, respond with a JSON object describing an ordered chain of steps.`,
    ``,
    `Available node types -- use only these "type" values:`,
    describeNodeTypesForPrompt(),
    ``,
    `Respond with a JSON object exactly matching this shape, and nothing else:`,
    `{"name": string, "description": string, "steps": [{"type": string, "label": string, "config": object}]}`,
    ``,
    `Rules:`,
    `- steps[0] must be a "trigger" node.`,
    `- The chain always ends by producing a real output -- include an "output" node as the last step unless the described work is purely internal.`,
    `- Every step after the first should follow naturally from the one before it -- this is a single linear chain, not a branching graph.`,
    `- "config" should only set fields that node type actually has (see the list above); omit fields you have no opinion on.`,
    `- For an "llm" step, write a real, specific systemPrompt describing exactly what to ask the model, grounded in the user's description.`,
    `- Keep the chain short: 3-6 steps is typical, 8 is the maximum.`,
    `- Respond with JSON only -- no prose, no markdown fences.`,
  ].join("\n");
}

/**
 * Builds a real, connected graph from a plan -- unknown node types are
 * dropped (not rejected outright: one bad step shouldn't sink an otherwise
 * reasonable plan), and a plan missing a trigger or a terminal output gets
 * one appended so `validateGraph`'s two structural checks have the best
 * chance of passing without a second model round-trip.
 *
 * Nodes are assembled one at a time, each wired to the previous one as it's
 * created (never a separate "connect them all afterward" pass over an
 * already-built array) -- inserting a "transform" bridge node when two
 * adjacent ports aren't type-compatible needs to know exactly where in the
 * final sequence it landed, which a second pass over pre-built positions
 * would have to re-derive.
 */
/** Exported for features/marketing/hero/fallback-graph.ts (E1), which needs
 *  the exact same bridge-insertion/position-assembly behavior for its
 *  hand-authored fallback plan that a real generated plan gets -- so the
 *  fallback graph is guaranteed structurally valid (passes `validateGraph`,
 *  never needs its own copy of the port-compatibility/bridging logic) rather
 *  than being a second, driftable hand-wired graph. */
export function assembleGraph(plan: GeneratedPlan): GeneratedAgent["graph"] {
  const validSteps = plan.steps.filter((step) => getNodeType(step.type) !== undefined);
  const steps = validSteps.length > 0 ? validSteps : [{ type: "trigger", label: "Start", config: {} }];

  if (steps[0]!.type !== "trigger") {
    steps.unshift({ type: "trigger", label: "Start", config: {} });
  }
  const last = steps[steps.length - 1]!;
  if (getNodeType(last.type)!.outputs.length > 0 && last.type !== "output") {
    steps.push({ type: "output", label: "Result", config: {} });
  }

  const nodes: AgentNode[] = [];
  const edges: GeneratedAgent["graph"]["edges"] = [];
  let previous: AgentNode | null = null;

  for (const step of steps) {
    const definition = getNodeType(step.type)!;
    const configResult = definition.configSchema.safeParse({ ...definition.defaultConfig, ...step.config });
    const node = createNode(step.type, { x: 0, y: Y_POSITION }, {
      label: step.label,
      config: configResult.success ? configResult.data : definition.defaultConfig,
    });

    if (previous) {
      const previousDefinition = getNodeType(previous.type!)!;
      const sourcePort = previousDefinition.outputs[0];
      const targetPort = definition.inputs[0];

      if (sourcePort && targetPort && !arePortTypesCompatible(sourcePort.type, targetPort.type)) {
        const bridgeDefinition = getNodeType("transform")!;
        const bridge = createNode("transform", { x: 0, y: Y_POSITION }, { label: "Bridge" });
        edges.push({ id: generateEdgeId(), source: previous.id, sourceHandle: sourcePort.id, target: bridge.id, targetHandle: bridgeDefinition.inputs[0]!.id });
        edges.push({ id: generateEdgeId(), source: bridge.id, sourceHandle: bridgeDefinition.outputs[0]!.id, target: node.id, targetHandle: targetPort.id });
        nodes.push(bridge);
      } else if (sourcePort && targetPort) {
        edges.push({ id: generateEdgeId(), source: previous.id, sourceHandle: sourcePort.id, target: node.id, targetHandle: targetPort.id });
      }
    }

    nodes.push(node);
    previous = node;
  }

  nodes.forEach((node, index) => {
    node.position = { x: index * X_SPACING, y: Y_POSITION };
  });

  return { nodes, edges };
}

export interface GenerateFromDescriptionOptions {
  signal?: AbortSignal;
}

/** Calls Groq (JSON mode) and returns a validated plan, or throws one of
 *  this function's own two specific error messages. Split out from
 *  `generateAgentFromDescription` purely so `withRetry` (below) has a
 *  single attempt to retry, not the whole assemble/validate pipeline. */
async function requestPlan(description: string, signal?: AbortSignal): Promise<GeneratedPlan> {
  const response = await getProvider().complete({
    model: STRUCTURED_GENERATION_MODEL,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: description },
    ],
    temperature: 0.4,
    responseFormat: "json",
    signal,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.content);
  } catch {
    throw new Error("The model didn't return a usable agent plan. Try rephrasing the description.");
  }

  const plan = planSchema.safeParse(parsed);
  if (!plan.success) {
    throw new Error("The model's agent plan was missing required fields. Try rephrasing the description.");
  }
  return plan.data;
}

/** The one entry point -- calls Groq (JSON mode), validates the shape, and
 *  assembles a real graph. A response that fails JSON-parse or schema
 *  validation is retried once (`LLM_CALL_RETRY_POLICY`, the same policy the
 *  run engine gives every real `llm_call` step) before this throws --
 *  open-weight models in JSON mode occasionally produce a malformed or
 *  truncated response even for a perfectly ordinary prompt (confirmed via
 *  this file's own fixture test: E1's own 10-fixture gate item measured a
 *  real ~40-80% single-attempt failure rate for some fixtures purely from
 *  this class of transient bad output, unrelated to the description's own
 *  quality). A genuinely bad request still fails after the retry and
 *  surfaces the same specific error either way (gate item 7's "specific
 *  error, working retry" -- a user-triggered retry after that still just
 *  re-runs this same function). */
export async function generateAgentFromDescription(
  description: string,
  options: GenerateFromDescriptionOptions = {},
): Promise<GeneratedAgent> {
  const { value: plan } = await withRetry(() => requestPlan(description, options.signal), LLM_CALL_RETRY_POLICY, options.signal);

  const graph = assembleGraph(plan);
  const issues = validateGraph(
    graph.nodes.map((node) => ({ id: node.id, type: node.type, data: node.data })),
    graph.edges,
  );

  return { name: plan.name, description: plan.description, graph, issues };
}
