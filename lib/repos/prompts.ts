import { desc, eq } from "drizzle-orm";
import { promptLibrary, users } from "@/db/schema";
import { withScope } from "./db";

export interface PromptRecord {
  id: string;
  title: string;
  content: string;
  authorName: string | null;
  createdAt: Date;
}

/** Workspace-shared, unlike `copilot_threads` -- every member sees every
 *  saved prompt, ordered newest-first so a prompt someone just saved is the
 *  first thing `/` shows. */
export async function listPrompts(workspaceId: string): Promise<PromptRecord[]> {
  const rows = await withScope({ workspaceId }, (tx) =>
    tx
      .select({
        id: promptLibrary.id,
        title: promptLibrary.title,
        content: promptLibrary.content,
        authorName: users.name,
        createdAt: promptLibrary.createdAt,
      })
      .from(promptLibrary)
      .leftJoin(users, eq(users.id, promptLibrary.createdBy))
      .where(eq(promptLibrary.workspaceId, workspaceId))
      .orderBy(desc(promptLibrary.createdAt)),
  );
  return rows;
}

export async function createPrompt(
  workspaceId: string,
  input: { title: string; content: string; createdBy: string | null },
): Promise<PromptRecord> {
  const [row] = await withScope({ workspaceId }, (tx) =>
    tx
      .insert(promptLibrary)
      .values({ workspaceId, title: input.title, content: input.content, createdBy: input.createdBy })
      .returning(),
  );
  if (!row) throw new Error("prompt insert failed");

  let authorName: string | null = null;
  if (row.createdBy) {
    const [author] = await withScope({ workspaceId }, (tx) =>
      tx.select({ name: users.name }).from(users).where(eq(users.id, row.createdBy!)).limit(1),
    );
    authorName = author?.name ?? null;
  }

  return { id: row.id, title: row.title, content: row.content, authorName, createdAt: row.createdAt };
}
