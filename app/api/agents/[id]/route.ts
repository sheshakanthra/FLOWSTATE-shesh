import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { agentStatusEnum } from "@/db/schema";
import { getAgentDetail, updateAgent } from "@/lib/repos/agents";

const graphSchema = z.object({
  nodes: z.array(z.unknown()),
  edges: z.array(z.unknown()),
});

const viewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
});

/**
 * One field, at minimum, besides `workspaceSlug` -- both the debounced graph
 * autosave (features/agents/lib/persist.ts) and the Inspector's
 * agent-settings form (name/description) go through this same route, so the
 * body is a partial patch rather than a fixed shape either caller must
 * fully populate.
 */
const patchSchema = z
  .object({
    workspaceSlug: z.string().min(1),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    graph: graphSchema.optional(),
    viewport: viewportSchema.optional(),
    // C3: undoing/redoing a copilot-created agent (features/copilot/actions/
    // undo-dispatch.ts) flips this between "draft" and "archived" -- the
    // same status B6's schema comment already documents as a real, honestly
    // modeled lifecycle value, not a UI-only toggle. No other caller in this
    // codebase sets it through this route yet.
    status: z.enum(agentStatusEnum.enumValues).optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.description !== undefined ||
      body.graph !== undefined ||
      body.viewport !== undefined ||
      body.status !== undefined,
    { message: "Nothing to update." },
  );

/** Backs the agents index table's "Export" row action (session spec item 7)
 *  -- that page doesn't already have the agent's graph loaded client-side
 *  the way the builder page does, so exporting from there needs a real
 *  fetch. `workspaceSlug` rides as a query parameter (GET has no body),
 *  matching B5's trace route precedent for the same reason. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: agentId } = await params;
  const workspaceSlug = new URL(request.url).searchParams.get("workspaceSlug");
  if (!workspaceSlug) {
    return Response.json({ error: "workspaceSlug query parameter is required." }, { status: 400 });
  }

  const context = await requireRole(request, workspaceSlug, "member");
  if (context instanceof Response) return context;

  const agent = await getAgentDetail(context.workspace.id, agentId);
  if (!agent) return Response.json({ error: "Agent not found." }, { status: 404 });

  return Response.json({ agent });
}

/**
 * Any workspace member may save their own edits to an agent's graph or
 * metadata -- unlike the workspace rename route (owner-only), nothing in
 * B3's scope gates agent editing behind a role, so `requireRole`'s lowest
 * rank ("member") is the check: still "signed in, still a member of this
 * workspace," just not elevated. `updateAgent` itself re-scopes through RLS
 * via `workspaceId`, so even a request that guessed a real `agentId` from
 * another workspace fails closed (404, not a cross-tenant write) exactly
 * like `getAgentById`'s doc comment describes.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: agentId } = await params;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const context = await requireRole(request, parsed.data.workspaceSlug, "member");
  if (context instanceof Response) return context;

  const updated = await updateAgent(context.workspace.id, agentId, {
    name: parsed.data.name,
    description: parsed.data.description,
    graph: parsed.data.graph,
    viewport: parsed.data.viewport,
    status: parsed.data.status,
  });
  if (!updated) {
    return Response.json({ error: "Agent not found." }, { status: 404 });
  }

  return Response.json({ updatedAt: updated.updatedAt.toISOString() });
}
