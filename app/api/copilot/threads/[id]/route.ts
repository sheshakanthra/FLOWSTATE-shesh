import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { getSessionFromRequest } from "@/lib/auth/session";
import { deleteThread, getThread, listMessages, renameThread } from "@/lib/repos/copilot";

const renameSchema = z.object({
  workspaceSlug: z.string().min(1),
  title: z.string().trim().min(1).max(200),
});

const deleteSchema = z.object({ workspaceSlug: z.string().min(1) });

/**
 * Session spec item 9: "threads survive reload." The dock only ever holds
 * thread state in a client store (features/copilot/threads/store.ts) and a
 * per-thread message store (features/copilot/messages/store.ts) -- neither
 * persists across a real page reload -- so re-opening a thread has to fetch
 * its messages from here, the same way ThreadList already fetches the
 * thread list itself on mount.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspaceSlug = new URL(request.url).searchParams.get("workspaceSlug");
  if (!workspaceSlug) {
    return Response.json({ error: "Missing workspaceSlug." }, { status: 400 });
  }

  const context = await requireRole(request, workspaceSlug, "member");
  if (context instanceof Response) return context;

  const userId = getSessionFromRequest(request)?.userId;
  if (!userId) return Response.json({ error: "Sign in to continue." }, { status: 401 });

  const thread = await getThread(context.workspace.id, userId, id);
  if (!thread) return Response.json({ error: "Conversation not found." }, { status: 404 });

  const messages = await listMessages(context.workspace.id, id);
  return Response.json({ thread, messages });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = renameSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Give the thread a name between 1 and 200 characters." }, { status: 400 });
  }

  const context = await requireRole(request, parsed.data.workspaceSlug, "member");
  if (context instanceof Response) return context;

  const userId = getSessionFromRequest(request)?.userId;
  if (!userId) return Response.json({ error: "Sign in to continue." }, { status: 401 });

  const thread = await renameThread(context.workspace.id, userId, id, parsed.data.title);
  if (!thread) return Response.json({ error: "Thread not found." }, { status: 404 });
  return Response.json({ thread });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const context = await requireRole(request, parsed.data.workspaceSlug, "member");
  if (context instanceof Response) return context;

  const userId = getSessionFromRequest(request)?.userId;
  if (!userId) return Response.json({ error: "Sign in to continue." }, { status: 401 });

  const deleted = await deleteThread(context.workspace.id, userId, id);
  if (!deleted) return Response.json({ error: "Thread not found." }, { status: 404 });
  return Response.json({ ok: true });
}
