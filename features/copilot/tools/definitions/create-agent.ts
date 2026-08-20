import { z } from "zod";
import { createAgent, type AgentGraphPayload } from "@/lib/repos/agents";
import { generateAgentFromDescription } from "@/features/agents/generation/generate-from-description";
import type { ToolCommitResult, ToolDefinition } from "../types";

const inputSchema = z.object({
  description: z.string().min(1).max(1000),
});
type Input = z.infer<typeof inputSchema>;

interface PreviewData {
  graph: AgentGraphPayload;
  issueCount: number;
}

interface CommitPayload {
  name: string;
  description: string;
  graph: AgentGraphPayload;
}

/**
 * "Build me an agent that qualifies inbound leads" -- the demo moment (spec
 * Notes). `run()` only ever *generates* a graph (features/agents/generation/
 * generate-from-description.ts); nothing is written to the database until
 * `commit()`, which only runs after a person approves the preview -- the
 * approval rule (spec item 3) applies here exactly like every other
 * mutating tool.
 */
export const createAgentTool: ToolDefinition<Input, PreviewData, CommitPayload> = {
  name: "create_agent_from_description",
  description:
    "Generates a new agent's node graph from a plain-English description of what it should do. Use this when the user asks to build, create, or set up a new agent. Does not run the agent or save it -- the user must approve the generated graph first.",
  inputSchema,
  parameters: {
    type: "object",
    properties: {
      description: { type: "string", description: "What the agent should do, in the user's own words." },
    },
    required: ["description"],
  },
  requiredRole: "member",
  mutates: true,
  async run(input, ctx) {
    void ctx;
    const generated = await generateAgentFromDescription(input.description);
    const nodeCount = generated.graph.nodes.length;
    return {
      preview: {
        kind: "graph",
        summary: `Create "${generated.name}" (${nodeCount} node${nodeCount === 1 ? "" : "s"})${
          generated.issues.length > 0 ? ` -- ${generated.issues.length} issue${generated.issues.length === 1 ? "" : "s"} to fix after creating` : ""
        }`,
        data: { graph: generated.graph, issueCount: generated.issues.length },
      },
      commitPayload: { name: generated.name, description: generated.description, graph: generated.graph },
    };
  },
  async commit(payload, _input, ctx): Promise<ToolCommitResult> {
    const agent = await createAgent(ctx.workspaceId, {
      name: payload.name,
      description: payload.description,
      graph: payload.graph,
      createdBy: ctx.userId,
    });
    return {
      summary: `Created ${agent.name}`,
      href: `/w/${ctx.workspaceSlug}/agents/${agent.id}/build`,
      undo: { kind: "archive_agent", payload: { agentId: agent.id, workspaceSlug: ctx.workspaceSlug } },
    };
  },
};
