import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { getSessionFromRequest } from "@/lib/auth/session";
import { getAgentDetail, updateAgent, type AgentGraphPayload } from "@/lib/repos/agents";
import { createVersion } from "@/lib/repos/agent-versions";
import { validateGraph, type ValidatableEdge, type ValidatableNode } from "@/features/agents/lib/validate-graph";

const bodySchema = z.object({
  workspaceSlug: z.string().min(1),
  note: z.string().optional(),
});

/**
 * Session spec item 5: publishing is blocked while validation fails. This
 * route is the *authoritative* check -- the publish dialog runs the exact
 * same `validateGraph` client-side first (against the live draft in
 * `graph-store`, for instant feedback before the user even opens the
 * dialog), but that pass is a UX nicety, not the real gate: nothing stops a
 * request from hitting this endpoint directly, bypassing the dialog
 * entirely, so the block has to be re-enforced here regardless of what the
 * client already showed.
 *
 * On success: `lib/repos/agent-versions.ts`'s `createVersion` snapshots the
 * current draft into an immutable `agent_versions` row (gate item 1) and
 * the agent's own `status` moves to `published` if it wasn't already --
 * `agents.graph_jsonb` itself is left completely untouched, which is what
 * "draft isolation" (gate item 2) actually rests on: the draft a user keeps
 * editing after publishing is the same live column it always was, not
 * copied or reset by this action.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: agentId } = await params;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const context = await requireRole(request, parsed.data.workspaceSlug, "member");
  if (context instanceof Response) return context;
  const workspaceId = context.workspace.id;

  const agent = await getAgentDetail(workspaceId, agentId);
  if (!agent) {
    return Response.json({ error: "Agent not found." }, { status: 404 });
  }

  const graph = (agent.graph ?? { nodes: [], edges: [] }) as AgentGraphPayload;
  const issues = validateGraph(graph.nodes as ValidatableNode[], graph.edges as ValidatableEdge[]);
  if (issues.length > 0) {
    return Response.json({ error: "This agent has unresolved validation errors.", issues }, { status: 422 });
  }

  const createdBy = getSessionFromRequest(request)?.userId ?? null;
  const version = await createVersion(workspaceId, agentId, graph, {
    createdBy,
    note: parsed.data.note?.trim() ? parsed.data.note.trim() : undefined,
  });

  if (agent.status !== "published") {
    await updateAgent(workspaceId, agentId, { status: "published" });
  }

  return Response.json({ version }, { status: 201 });
}
