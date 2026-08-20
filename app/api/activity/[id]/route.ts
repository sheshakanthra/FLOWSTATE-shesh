import { requireRole } from "@/lib/auth/guard";
import { deleteActivityEvent } from "@/lib/repos/activity";

/** The undo half of `POST /api/activity` -- `draft_message`'s undo
 *  dispatcher (features/copilot/actions/undo-dispatch.ts) deletes the
 *  activity event its own approved commit logged. `workspaceSlug` rides as
 *  a query parameter, matching B5's/B6's own GET-with-no-body precedent for
 *  a route that otherwise has nowhere to carry it -- kept here on DELETE
 *  too since this route never needs a body. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspaceSlug = new URL(request.url).searchParams.get("workspaceSlug");
  if (!workspaceSlug) {
    return Response.json({ error: "workspaceSlug query parameter is required." }, { status: 400 });
  }

  const context = await requireRole(request, workspaceSlug, "member");
  if (context instanceof Response) return context;

  const deleted = await deleteActivityEvent(context.workspace.id, id);
  if (!deleted) return Response.json({ error: "Activity event not found." }, { status: 404 });
  return Response.json({ ok: true });
}
