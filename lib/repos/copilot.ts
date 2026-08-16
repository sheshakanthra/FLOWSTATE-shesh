import { and, desc, eq } from "drizzle-orm";
import { copilotThreads } from "@/db/schema";
import { withScope } from "./db";

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
