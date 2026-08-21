import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { getRun, requestRunCancellation } from "@/lib/repos/runs";

const bodySchema = z.object({ workspaceSlug: z.string().min(1) });

/**
 * D2 gate item 4's cross-tab cancel -- the in-flight zone's Cancel button
 * (features/today/inflight/cancel.ts) calls this, not the run's own NDJSON
 * connection (that connection belongs to whichever tab/request started the
 * run, which the in-flight card usually isn't). Sets `agent_runs.cancel_requested`;
 * `app/api/agents/[id]/run/route.ts`'s own poll loop is what actually
 * notices and aborts the in-flight execution -- see that route's doc
 * comment for why a column, not shared module state.
 *
 * A no-op (200, not an error) if the run has already finished by the time
 * this lands -- a real, benign race between the run's own last step and a
 * user clicking Cancel a moment too late, not a failure worth surfacing.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string; runId: string }> }) {
  const { id: agentId, runId } = await params;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const context = await requireRole(request, parsed.data.workspaceSlug, "member");
  if (context instanceof Response) return context;

  const run = await getRun(context.workspace.id, runId);
  if (!run || run.agentId !== agentId) {
    return Response.json({ error: "Run not found." }, { status: 404 });
  }

  if (run.status === "running") {
    await requestRunCancellation(context.workspace.id, runId);
  }

  return Response.json({ ok: true });
}
