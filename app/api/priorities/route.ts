import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import {
  getPriorityItem,
  listPriorityItems,
  setPriorityItemAssignee,
  setPriorityItemResolved,
  setPriorityItemSnoozedUntil,
} from "@/lib/repos/priorities";

/**
 * GET lists the active queue (gate item 3's data source); PATCH is the one
 * mutation endpoint behind every inline action (resolve, snooze, delegate --
 * spec item 4) and their ⌘Z undo (gate item 5), which is the *same* PATCH
 * with the field set back to its previous value. One route, a partial-patch
 * body, matching `app/api/agents/[id]/route.ts`'s own convention -- there's
 * no per-action sub-route because there's no per-action authorization or
 * validation difference between them.
 */
export async function GET(request: Request) {
  const workspaceSlug = new URL(request.url).searchParams.get("workspaceSlug");
  if (!workspaceSlug) {
    return Response.json({ error: "workspaceSlug query parameter is required." }, { status: 400 });
  }

  const context = await requireRole(request, workspaceSlug, "member");
  if (context instanceof Response) return context;

  const items = await listPriorityItems(context.workspace.id);
  return Response.json({ items });
}

const patchSchema = z
  .object({
    workspaceSlug: z.string().min(1),
    itemId: z.string().min(1),
    resolved: z.boolean().optional(),
    // `null` clears a snooze/delegate -- explicitly part of the schema
    // (not just "field absent means clear") since ⌘Z's undo of a snooze or
    // a delegate needs to say "set this back to nothing," which is a real,
    // different request than "don't touch this field."
    snoozedUntil: z.string().datetime().nullable().optional(),
    assigneeId: z.string().nullable().optional(),
  })
  .refine((body) => body.resolved !== undefined || body.snoozedUntil !== undefined || body.assigneeId !== undefined, {
    message: "Nothing to update.",
  });

export async function PATCH(request: Request) {
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const context = await requireRole(request, parsed.data.workspaceSlug, "member");
  if (context instanceof Response) return context;
  const workspaceId = context.workspace.id;

  const existing = await getPriorityItem(workspaceId, parsed.data.itemId);
  if (!existing) {
    return Response.json({ error: "Priority item not found." }, { status: 404 });
  }

  if (parsed.data.resolved !== undefined) {
    await setPriorityItemResolved(workspaceId, parsed.data.itemId, parsed.data.resolved);
  }
  if (parsed.data.snoozedUntil !== undefined) {
    await setPriorityItemSnoozedUntil(workspaceId, parsed.data.itemId, parsed.data.snoozedUntil ? new Date(parsed.data.snoozedUntil) : null);
  }
  if (parsed.data.assigneeId !== undefined) {
    await setPriorityItemAssignee(workspaceId, parsed.data.itemId, parsed.data.assigneeId);
  }

  const updated = await getPriorityItem(workspaceId, parsed.data.itemId);
  return Response.json({ item: updated });
}
