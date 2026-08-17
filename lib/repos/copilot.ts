import { and, eq, desc, gte } from "drizzle-orm";
import { copilotMessages, copilotThreads, type copilotRoleEnum } from "@/db/schema";
import { withScope } from "./db";

export type CopilotRole = (typeof copilotRoleEnum.enumValues)[number];

/** What `citations` jsonb actually holds -- resolved against the retrieved
 *  set server-side (features/copilot/lib/retrieve.ts) before this is ever
 *  written, so a row in this column is always a real, navigable record. */
export interface CitationRecord {
  id: string;
  type: "agent" | "run";
  label: string;
  href: string;
}

export interface CopilotMessageRecord {
  id: string;
  role: CopilotRole;
  content: string;
  /** Null for user/system messages. For an assistant message, always a real
   *  array (possibly empty) -- retrieval runs on every turn, so "no
   *  citations" and "no retrieval attempted" never need to be told apart. */
  citations: CitationRecord[] | null;
  createdAt: Date;
}

function toMessageRecord(row: typeof copilotMessages.$inferSelect): CopilotMessageRecord {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    citations: (row.citations as CitationRecord[] | null) ?? null,
    createdAt: row.createdAt,
  };
}

export interface CopilotThreadRecord {
  id: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const THREAD_COLUMNS = {
  id: copilotThreads.id,
  title: copilotThreads.title,
  createdAt: copilotThreads.createdAt,
  updatedAt: copilotThreads.updatedAt,
};

/**
 * Copilot threads are per user *within* a workspace, so these queries carry
 * a `userId` filter on top of RLS rather than relying on the policy alone:
 * `copilot_threads`' policy isolates workspaces (see
 * db/migrations/0001_row_level_security.sql), which is the tenancy boundary,
 * but two people in the same workspace still shouldn't read each other's
 * conversations. The database enforces the boundary that protects other
 * customers; this file enforces the one that protects a teammate's drafts.
 *
 * `agent_versions`-style ordering: newest first, since the thread list is a
 * recency list, not an archive.
 */
export async function listThreads(workspaceId: string, userId: string): Promise<CopilotThreadRecord[]> {
  return withScope({ workspaceId }, (tx) =>
    tx
      .select(THREAD_COLUMNS)
      .from(copilotThreads)
      .where(eq(copilotThreads.userId, userId))
      .orderBy(desc(copilotThreads.updatedAt)),
  );
}

export async function createThread(
  workspaceId: string,
  userId: string,
  title: string | null,
): Promise<CopilotThreadRecord> {
  const [thread] = await withScope({ workspaceId }, (tx) =>
    tx.insert(copilotThreads).values({ workspaceId, userId, title }).returning(THREAD_COLUMNS),
  );
  if (!thread) throw new Error("copilot thread insert failed");
  return thread;
}

export async function renameThread(
  workspaceId: string,
  userId: string,
  threadId: string,
  title: string,
): Promise<CopilotThreadRecord | null> {
  const [thread] = await withScope({ workspaceId }, (tx) =>
    tx
      .update(copilotThreads)
      .set({ title, updatedAt: new Date() })
      .where(and(eq(copilotThreads.id, threadId), eq(copilotThreads.userId, userId)))
      .returning(THREAD_COLUMNS),
  );
  return thread ?? null;
}

export async function deleteThread(workspaceId: string, userId: string, threadId: string): Promise<boolean> {
  const deleted = await withScope({ workspaceId }, (tx) =>
    tx
      .delete(copilotThreads)
      .where(and(eq(copilotThreads.id, threadId), eq(copilotThreads.userId, userId)))
      .returning({ id: copilotThreads.id }),
  );
  return deleted.length > 0;
}

/** Ownership check for every C2 route that acts on an existing thread (the
 *  stream endpoint, and this file's own message helpers below don't repeat
 *  it) -- `null` covers both "no such thread" and "not yours," which the
 *  caller maps to the same 404 either way rather than leaking which one it
 *  was. */
export async function getThread(
  workspaceId: string,
  userId: string,
  threadId: string,
): Promise<CopilotThreadRecord | null> {
  const [thread] = await withScope({ workspaceId }, (tx) =>
    tx
      .select(THREAD_COLUMNS)
      .from(copilotThreads)
      .where(and(eq(copilotThreads.id, threadId), eq(copilotThreads.userId, userId)))
      .limit(1),
  );
  return thread ?? null;
}

/** Session spec item 9: message persistence. Ordered by `createdAt` --
 *  messages in one thread are appended strictly one at a time by a single
 *  user's own requests, so insertion order and recency order never diverge
 *  in practice. */
export async function listMessages(workspaceId: string, threadId: string): Promise<CopilotMessageRecord[]> {
  const rows = await withScope({ workspaceId }, (tx) =>
    tx.select().from(copilotMessages).where(eq(copilotMessages.threadId, threadId)).orderBy(copilotMessages.createdAt),
  );
  return rows.map(toMessageRecord);
}

export interface AppendMessageInput {
  role: CopilotRole;
  content: string;
  citations?: CitationRecord[] | null;
}

/** Bumps the thread's `updatedAt` in the same transaction, since the thread
 *  list (features/copilot/threads/list.tsx) orders by recency and a
 *  conversation someone just spoke in should sort above one they haven't
 *  touched in days. */
export async function appendMessage(
  workspaceId: string,
  threadId: string,
  input: AppendMessageInput,
): Promise<CopilotMessageRecord> {
  return withScope({ workspaceId }, async (tx) => {
    const [row] = await tx
      .insert(copilotMessages)
      .values({
        workspaceId,
        threadId,
        role: input.role,
        content: input.content,
        citations: input.citations ?? null,
      })
      .returning();
    if (!row) throw new Error("copilot message insert failed");
    await tx.update(copilotThreads).set({ updatedAt: new Date() }).where(eq(copilotThreads.id, threadId));
    return toMessageRecord(row);
  });
}

export async function getMessage(
  workspaceId: string,
  threadId: string,
  messageId: string,
): Promise<CopilotMessageRecord | null> {
  const [row] = await withScope({ workspaceId }, (tx) =>
    tx
      .select()
      .from(copilotMessages)
      .where(and(eq(copilotMessages.id, messageId), eq(copilotMessages.threadId, threadId)))
      .limit(1),
  );
  return row ? toMessageRecord(row) : null;
}

/**
 * Deletes `fromMessageId` and every message after it in the thread (by
 * `createdAt`). The one primitive both edit-and-resend and regenerate (gate
 * items 6/7) truncate through: edit deletes the old user message onward and
 * the route appends its replacement; regenerate deletes the old assistant
 * reply onward (nothing after it in practice) and the route re-streams
 * against the user message that's still there.
 */
export async function deleteMessagesFrom(workspaceId: string, threadId: string, fromMessageId: string): Promise<void> {
  await withScope({ workspaceId }, async (tx) => {
    const [target] = await tx
      .select({ createdAt: copilotMessages.createdAt })
      .from(copilotMessages)
      .where(and(eq(copilotMessages.id, fromMessageId), eq(copilotMessages.threadId, threadId)))
      .limit(1);
    if (!target) return;
    await tx
      .delete(copilotMessages)
      .where(and(eq(copilotMessages.threadId, threadId), gte(copilotMessages.createdAt, target.createdAt)));
  });
}

/** Gate item 5's Stop button: records that `requestId` should be cancelled.
 *  See db/schema.ts's `cancelRequestedId` doc comment for why this is a
 *  column read by both routes over a real Postgres connection rather than
 *  in-memory state shared via a module import. */
export async function setCancelRequested(workspaceId: string, threadId: string, requestId: string): Promise<void> {
  await withScope({ workspaceId }, (tx) =>
    tx.update(copilotThreads).set({ cancelRequestedId: requestId }).where(eq(copilotThreads.id, threadId)),
  );
}

/** Polled (throttled) by the in-flight streaming request for `threadId` --
 *  true only when the id matches *this* stream's own requestId, not just
 *  any cancellation ever requested on the thread. */
export async function isCancelRequested(workspaceId: string, threadId: string, requestId: string): Promise<boolean> {
  const [row] = await withScope({ workspaceId }, (tx) =>
    tx.select({ cancelRequestedId: copilotThreads.cancelRequestedId }).from(copilotThreads).where(eq(copilotThreads.id, threadId)).limit(1),
  );
  return row?.cancelRequestedId === requestId;
}

/** Clears the flag once the stream it belongs to actually stops (success,
 *  error, or cancellation) -- scoped to `requestId` so a stream that raced
 *  past its own cancellation check right as it finished naturally can't
 *  wipe out a *different*, newer stream's still-pending cancellation. */
export async function clearCancelRequested(workspaceId: string, threadId: string, requestId: string): Promise<void> {
  await withScope({ workspaceId }, (tx) =>
    tx
      .update(copilotThreads)
      .set({ cancelRequestedId: null })
      .where(and(eq(copilotThreads.id, threadId), eq(copilotThreads.cancelRequestedId, requestId))),
  );
}
