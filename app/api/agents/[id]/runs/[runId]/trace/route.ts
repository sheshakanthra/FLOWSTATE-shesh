import { requireRole } from "@/lib/auth/guard";
import { getRunDetail, listRunSteps } from "@/lib/repos/runs";

/**
 * GET, not POST -- this is a read, and it needs to be callable from a plain
 * client-side `fetch()` with no body (run-diff.tsx fetches a *second* run's
 * trace on demand, separate from whatever the page itself server-rendered
 * for the primary run). `workspaceSlug` rides as a query parameter for the
 * same reason: a GET has no body to carry it in, unlike B4's POST /run
 * route.
 *
 * Returns the run header plus its ordered run_steps -- not the graph. The
 * graph is the same for both runs being compared in a diff (it's the
 * agent's current `graph_jsonb`, per B4's own precedent that a run always
 * executes the live draft, not a versioned snapshot), so the page that
 * already fetched it server-side is the one source for that; duplicating it
 * into every trace response would be wasted payload for run-diff's
 * steps-only need.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; runId: string }> }) {
  const { id: agentId, runId } = await params;

  const workspaceSlug = new URL(request.url).searchParams.get("workspaceSlug");
  if (!workspaceSlug) {
    return Response.json({ error: "workspaceSlug query parameter is required." }, { status: 400 });
  }

  const context = await requireRole(request, workspaceSlug, "member");
  if (context instanceof Response) return context;

  const run = await getRunDetail(context.workspace.id, runId);
  if (!run || run.agentId !== agentId) {
    return Response.json({ error: "Run not found." }, { status: 404 });
  }

  const steps = await listRunSteps(context.workspace.id, runId);
  return Response.json({ run, steps });
}
