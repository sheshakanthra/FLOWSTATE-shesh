// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { client, db } from "@/db/client";
import { agents, workspaces } from "@/db/schema";
import { getAgentById } from "./agents";
import { withScope } from "./db";

/**
 * The RLS proof named in A6's gate (item 2): a query for another
 * workspace's `agents` row returns zero rows. getAgentById() deliberately
 * filters only on `id` (see agents.ts), so this test only passes if
 * Postgres's row-level security — not application code — is what's hiding
 * the cross-workspace row. Requires DATABASE_URL to point at a real,
 * migrated Postgres instance (db/migrations, including
 * 0001_row_level_security.sql).
 */
describe("agents RLS", () => {
  let workspaceA: typeof workspaces.$inferSelect;
  let workspaceB: typeof workspaces.$inferSelect;
  let agentAId: string;

  beforeAll(async () => {
    const inserted = await db
      .insert(workspaces)
      .values([
        { name: "RLS Test — Workspace A", slug: `rls-test-a-${crypto.randomUUID()}` },
        { name: "RLS Test — Workspace B", slug: `rls-test-b-${crypto.randomUUID()}` },
      ])
      .returning();
    workspaceA = inserted[0]!;
    workspaceB = inserted[1]!;
  });

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, workspaceA.id));
    await db.delete(workspaces).where(eq(workspaces.id, workspaceB.id));
    await client.end();
  });

  it("returns the agent when scoped to its own workspace", async () => {
    // Goes through withScope (not a raw db.insert) because FORCE ROW LEVEL
    // SECURITY's WITH CHECK applies to writes too — an insert that never
    // sets app.workspace_id would be rejected by the same policy this test
    // is proving, not just silently unscoped.
    const [agent] = await withScope({ workspaceId: workspaceA.id }, (tx) =>
      tx.insert(agents).values({ workspaceId: workspaceA.id, name: "RLS probe agent", status: "draft" }).returning(),
    );
    agentAId = agent!.id;

    const found = await getAgentById(workspaceA.id, agentAId);
    expect(found?.id).toBe(agentAId);
  });

  it("hides the same agent when scoped to a different workspace", async () => {
    const found = await getAgentById(workspaceB.id, agentAId);
    expect(found).toBeNull();
  });
});
