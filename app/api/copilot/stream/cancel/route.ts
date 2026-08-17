import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { markRequestCancelled } from "@/features/copilot/lib/cancellation";

const cancelSchema = z.object({
  workspaceSlug: z.string().min(1),
  threadId: z.string().min(1),
  requestId: z.string().min(1),
});

/**
 * Gate item 5's actual cancellation trigger -- see
 * features/copilot/lib/cancellation.ts for why a separate request exists
 * (and why it writes to Postgres, not process memory) instead of relying on
 * the streaming fetch's own abort to reach the server. `requireRole` gates
 * this the same as the streaming request itself.
 */
export async function POST(request: Request) {
  const parsed = cancelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const context = await requireRole(request, parsed.data.workspaceSlug, "member");
  if (context instanceof Response) return context;

  await markRequestCancelled(context.workspace.id, parsed.data.threadId, parsed.data.requestId);
  return Response.json({ ok: true });
}
