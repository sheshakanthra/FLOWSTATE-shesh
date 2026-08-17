// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { client, db } from "@/db/client";
import { users, workspaces } from "@/db/schema";
import {
  appendMessage,
  createThread,
  deleteMessagesFrom,
  getThread,
  listMessages,
} from "./copilot";

/**
 * Session spec item 9: message persistence. Real workspace/user/thread rows
 * and real inserts -- deleteMessagesFrom's truncation (the primitive both
 * edit-and-resend and regenerate rely on) is exactly the kind of "delete
 * this row and everything after it" logic this repo's own precedent
 * (agent-versions.test.ts's immutability trigger) says needs a real
 * database, not a mock, to trust.
 */
describe("copilot message persistence", () => {
  let workspaceId: string;
  let otherWorkspaceId: string;
  let userId: string;
  let threadId: string;

  beforeAll(async () => {
    const [workspace, otherWorkspace] = await db
      .insert(workspaces)
      .values([
        { name: "Copilot Messages Test", slug: `copilot-messages-test-${crypto.randomUUID()}` },
        { name: "Copilot Messages Test (other)", slug: `copilot-messages-test-other-${crypto.randomUUID()}` },
      ])
      .returning();
    workspaceId = workspace!.id;
    otherWorkspaceId = otherWorkspace!.id;

    const [user] = await db
      .insert(users)
      .values({ email: `copilot-test-${crypto.randomUUID()}@example.com`, passwordHash: "x", name: "Test User" })
      .returning();
    userId = user!.id;

    const thread = await createThread(workspaceId, userId, "Test thread");
    threadId = thread.id;
  });

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    await db.delete(workspaces).where(eq(workspaces.id, otherWorkspaceId));
    await db.delete(users).where(eq(users.id, userId));
    await client.end();
  });

  it("getThread returns null for a real thread scoped to the wrong workspace", async () => {
    const found = await getThread(otherWorkspaceId, userId, threadId);
    expect(found).toBeNull();
  });

  it("appendMessage persists role, content, and citations; listMessages orders by creation", async () => {
    const user1 = await appendMessage(workspaceId, threadId, { role: "user", content: "Which agents failed most this week?" });
    const assistant1 = await appendMessage(workspaceId, threadId, {
      role: "assistant",
      content: "Lead Qualifier failed twice [cite:run-1].",
      citations: [{ id: "run-1", type: "run", label: "Lead Qualifier — failed run", href: "/w/acme/agents/a1/runs/run-1" }],
    });

    const messages = await listMessages(workspaceId, threadId);
    expect(messages.map((message) => message.id)).toEqual([user1.id, assistant1.id]);
    expect(messages[0]!.citations).toBeNull();
    expect(messages[1]!.citations).toEqual([
      { id: "run-1", type: "run", label: "Lead Qualifier — failed run", href: "/w/acme/agents/a1/runs/run-1" },
    ]);
  });

  it("deleteMessagesFrom removes the target message and everything after it, keeping earlier ones", async () => {
    const survivor = await appendMessage(workspaceId, threadId, { role: "user", content: "First question" });
    const target = await appendMessage(workspaceId, threadId, { role: "assistant", content: "First answer" });
    await appendMessage(workspaceId, threadId, { role: "user", content: "Follow-up question" });
    await appendMessage(workspaceId, threadId, { role: "assistant", content: "Follow-up answer" });

    await deleteMessagesFrom(workspaceId, threadId, target.id);

    const remaining = await listMessages(workspaceId, threadId);
    const remainingIds = remaining.map((message) => message.id);
    expect(remainingIds).toContain(survivor.id);
    expect(remainingIds).not.toContain(target.id);
    // Nothing created at or after the deleted target's timestamp survives.
    expect(remaining.every((message) => message.createdAt < target.createdAt)).toBe(true);
  });
});
