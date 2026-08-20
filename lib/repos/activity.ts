import { and, desc, eq, gte } from "drizzle-orm";
import { activityEvents } from "@/db/schema";
import { withScope } from "./db";

export interface ActivityEventRecord {
  id: string;
  actorId: string | null;
  verb: string;
  subjectType: string;
  subjectId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

function toRecord(row: typeof activityEvents.$inferSelect): ActivityEventRecord {
  return {
    id: row.id,
    actorId: row.actorId,
    verb: row.verb,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    summary: row.summary,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt,
  };
}

/** `db/seed.ts`'s own `verb`/`subjectType` vocabulary ("agent.created",
 *  "client.updated", ...) with no enum backing it -- this file doesn't
 *  invent a stricter shape than the seed data already established. */
export async function listActivityEvents(
  workspaceId: string,
  options: { since?: Date; limit?: number } = {},
): Promise<ActivityEventRecord[]> {
  const { since, limit = 60 } = options;
  const conditions = [eq(activityEvents.workspaceId, workspaceId)];
  if (since) conditions.push(gte(activityEvents.createdAt, since));

  const rows = await withScope({ workspaceId }, (tx) =>
    tx
      .select()
      .from(activityEvents)
      .where(and(...conditions))
      .orderBy(desc(activityEvents.createdAt))
      .limit(limit),
  );
  return rows.map(toRecord);
}

export interface LogActivityEventInput {
  actorId: string | null;
  verb: string;
  subjectType: string;
  subjectId?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
}

/** `draft_message`'s commit step (features/copilot/tools/definitions/
 *  draft-message.ts): there's no client-messaging channel in this vertical
 *  slice (CRM/client portal are out of scope, per CLAUDE.md), so approving
 *  a drafted client update logs it as real workspace activity -- the same
 *  "client.updated" shape `db/seed.ts` already uses for exactly this kind of
 *  event -- rather than pretending to actually deliver it somewhere. */
export async function logActivityEvent(
  workspaceId: string,
  input: LogActivityEventInput,
): Promise<ActivityEventRecord> {
  const [row] = await withScope({ workspaceId }, (tx) =>
    tx
      .insert(activityEvents)
      .values({
        workspaceId,
        actorId: input.actorId,
        verb: input.verb,
        subjectType: input.subjectType,
        subjectId: input.subjectId ?? null,
        summary: input.summary,
        metadata: input.metadata ?? null,
      })
      .returning(),
  );
  if (!row) throw new Error("activity event insert failed");
  return toRecord(row);
}

/** The undo half of `logActivityEvent` -- `draft_message`'s approved commit
 *  registers this as its inverse (features/copilot/actions/undo-dispatch.ts)
 *  so ⌘Z on a copilot-sent client update behaves exactly like undoing any
 *  other mutation. Scoped by workspace via RLS the same as every other
 *  delete in this codebase; returns whether a row was actually removed so a
 *  double-undo (or an event already cleaned up some other way) is a no-op,
 *  not an error. */
export async function deleteActivityEvent(workspaceId: string, id: string): Promise<boolean> {
  const deleted = await withScope({ workspaceId }, (tx) =>
    tx.delete(activityEvents).where(eq(activityEvents.id, id)).returning({ id: activityEvents.id }),
  );
  return deleted.length > 0;
}
