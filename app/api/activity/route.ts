import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { getSessionFromRequest } from "@/lib/auth/session";
import { logActivityEvent } from "@/lib/repos/activity";

/**
 * Deliberately narrow, not a generic "write anything to activity_events"
 * endpoint: the only caller is `draft_message`'s undo/redo dispatcher
 * (features/copilot/actions/undo-dispatch.ts), redoing a copilot-approved
 * client update after it was undone (deleted). The verb/subjectType this
 * writes are hardcoded to mirror the tool's own commit step
 * (features/copilot/tools/definitions/draft-message.ts) exactly, rather
 * than accepted from the request body.
 */
const bodySchema = z.object({
  workspaceSlug: z.string().min(1),
  clientName: z.string().min(1).max(200),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const context = await requireRole(request, parsed.data.workspaceSlug, "member");
  if (context instanceof Response) return context;
  const userId = getSessionFromRequest(request)?.userId ?? null;

  const event = await logActivityEvent(context.workspace.id, {
    actorId: userId,
    verb: "client.message_sent",
    subjectType: "client",
    summary: `Sent "${parsed.data.subject}" to ${parsed.data.clientName}`,
    metadata: { clientName: parsed.data.clientName, subject: parsed.data.subject, body: parsed.data.body },
  });

  return Response.json({ event }, { status: 201 });
}
