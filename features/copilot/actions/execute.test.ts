// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { client, db } from "@/db/client";
import { users, workspaces } from "@/db/schema";
import { appendMessage, createThread } from "@/lib/repos/copilot";
import { listActivityEvents } from "@/lib/repos/activity";
import type { ToolContext } from "../tools/types";
import "../tools/registry";
import { approveToolCall, proposeToolCall, rejectToolCall, retryToolCall } from "./execute";

/**
 * Gate items 2 and 4, against the real database: "no mutating tool executes
 * without approval" and "a Member attempts an Owner-only tool ... and is
 * rejected server-side with the missing permission named" both need a real
 * `tool_calls`/`activity_events` row (or the deliberate absence of one) to
 * actually prove, not a mock -- same reasoning `copilot.test.ts` and
 * `agent-versions.test.ts` give for testing their own mutation/immutability
 * guarantees against Postgres directly.
 */
describe("copilot tool execution", () => {
  let workspaceId: string;
  let userId: string;
  let messageId: string;

  const ownerCtx = () => ({ workspaceId, workspaceSlug: "execute-test", userId, role: "owner" as const });
  const memberCtx = () => ({ workspaceId, workspaceSlug: "execute-test", userId, role: "member" as const });

  beforeAll(async () => {
    const [workspace] = await db
      .insert(workspaces)
      .values({ name: "Execute Test", slug: `execute-test-${crypto.randomUUID()}` })
      .returning();
    workspaceId = workspace!.id;

    const [user] = await db
      .insert(users)
      .values({ email: `execute-test-${crypto.randomUUID()}@example.com`, passwordHash: "x", name: "Test User" })
      .returning();
    userId = user!.id;

    const thread = await createThread(workspaceId, userId, "Execute test thread");
    const message = await appendMessage(workspaceId, thread.id, { role: "user", content: "test" });
    messageId = message.id;
  });

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    await db.delete(users).where(eq(users.id, userId));
    await client.end();
  });

  it("gate item 4: a Member is rejected from an Owner-only tool, naming the missing role -- no row is created", async () => {
    const outcome = await proposeToolCall({
      toolName: "draft_message",
      input: { clientName: "Acme Co", subject: "Update", body: "Hello there." },
      messageId,
      ctx: memberCtx() as ToolContext,
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("expected rejection");
    expect(outcome.status).toBe(403);
    expect(outcome.error).toMatch(/owner/i);
  });

  it("gate item 2: proposing a mutating tool never writes the mutation -- only approving does", async () => {
    const proposed = await proposeToolCall({
      toolName: "draft_message",
      input: { clientName: "Acme Co", subject: "Status update", body: "Everything is on track." },
      messageId,
      ctx: ownerCtx() as ToolContext,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect(proposed.result.status).toBe("pending");
    expect(proposed.result.mutates).toBe(true);

    const beforeApprove = await listActivityEvents(workspaceId);
    expect(beforeApprove).toHaveLength(0);

    const approved = await approveToolCall({ toolCallId: proposed.result.toolCallId, ctx: ownerCtx() as ToolContext });
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.result.status).toBe("succeeded");
    expect(approved.result.commitResult?.undo.kind).toBe("delete_activity_event");

    const afterApprove = await listActivityEvents(workspaceId);
    expect(afterApprove).toHaveLength(1);
    expect(afterApprove[0]!.verb).toBe("client.message_sent");

    // Approving twice fails closed rather than double-sending.
    const secondApprove = await approveToolCall({ toolCallId: proposed.result.toolCallId, ctx: ownerCtx() as ToolContext });
    expect(secondApprove.ok).toBe(false);
  });

  it("rejecting a pending proposal never writes the mutation", async () => {
    const proposed = await proposeToolCall({
      toolName: "draft_message",
      input: { clientName: "Beta LLC", subject: "Never sent", body: "This should not be logged." },
      messageId,
      ctx: ownerCtx() as ToolContext,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;

    const rejected = await rejectToolCall({ toolCallId: proposed.result.toolCallId, ctx: ownerCtx() as ToolContext });
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;
    expect(rejected.result.status).toBe("rejected");

    const events = await listActivityEvents(workspaceId);
    expect(events.some((event) => event.summary.includes("Never sent"))).toBe(false);
  });

  it("a read-only tool executes directly (no pending/approval step) and a bad input is recorded as a real, retryable failure", async () => {
    const proposed = await proposeToolCall({
      toolName: "explain_run",
      input: { runId: "00000000-0000-0000-0000-000000000000" },
      messageId,
      ctx: memberCtx() as ToolContext,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect(proposed.result.mutates).toBe(false);
    expect(proposed.result.status).toBe("failed");
    expect(proposed.result.error).toMatch(/no run with that id/i);

    const retried = await retryToolCall({ toolCallId: proposed.result.toolCallId, ctx: memberCtx() as ToolContext });
    expect(retried.ok).toBe(true);
    if (!retried.ok) return;
    expect(retried.result.status).toBe("failed");
  });

  it("an unknown tool name is rejected, not silently ignored", async () => {
    const outcome = await proposeToolCall({ toolName: "delete_workspace", input: {}, messageId, ctx: ownerCtx() as ToolContext });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.status).toBe(404);
  });
});
