// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { client, db } from "@/db/client";
import { agentRuns, agentVersions, agents, users, workspaces } from "@/db/schema";
import { createVersion, getLatestVersion, listVersions } from "./agent-versions";
import { withScope } from "./db";

/** Gate item 1: "a test that attempts to mutate a published version row
 *  fails" -- a real workspace/agent/user, real `createVersion` calls, and a
 *  real attempted UPDATE against the live database, not a mock of the
 *  trigger's behavior. */
describe("agent-versions", () => {
  let workspaceId: string;
  let agentId: string;
  let userId: string;

  beforeAll(async () => {
    const [workspace] = await db
      .insert(workspaces)
      .values({ name: "Agent Versions Test", slug: `agent-versions-test-${crypto.randomUUID()}` })
      .returning();
    workspaceId = workspace!.id;

    const [user] = await db
      .insert(users)
      .values({ email: `versions-test-${crypto.randomUUID()}@example.com`, passwordHash: "x", name: "Test Author" })
      .returning();
    userId = user!.id;

    const [agent] = await withScope({ workspaceId }, (tx) =>
      tx.insert(agents).values({ workspaceId, name: "Versioned Agent", status: "draft" }).returning(),
    );
    agentId = agent!.id;
  });

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    await db.delete(users).where(eq(users.id, userId));
    await client.end();
  });

  it("createVersion assigns incrementing version numbers per agent", async () => {
    const graph = { nodes: [], edges: [] };
    const v1 = await createVersion(workspaceId, agentId, graph, { createdBy: userId, note: "First" });
    const v2 = await createVersion(workspaceId, agentId, graph, { createdBy: userId, note: "Second" });
    expect(v1.version).toBe(1);
    expect(v2.version).toBe(2);
  });

  it("listVersions returns every version newest-first, with author name and run count joined in", async () => {
    const versions = await listVersions(workspaceId, agentId);
    expect(versions.map((v) => v.version)).toEqual([2, 1]);
    expect(versions[0]!.createdByName).toBe("Test Author");
    expect(versions[0]!.runCount).toBe(0);
  });

  it("getLatestVersion returns the highest version number", async () => {
    const latest = await getLatestVersion(workspaceId, agentId);
    expect(latest?.version).toBe(2);
  });

  it("counts a real recorded run against the exact version it ran", async () => {
    const version = await getLatestVersion(workspaceId, agentId);
    await withScope({ workspaceId }, (tx) =>
      tx.insert(agentRuns).values({
        workspaceId,
        agentId,
        agentVersionId: version!.id,
        status: "succeeded",
        trigger: "manual",
        startedAt: new Date(),
      }),
    );
    const versions = await listVersions(workspaceId, agentId);
    expect(versions.find((v) => v.id === version!.id)!.runCount).toBe(1);
  });

  it("gate item 1: the database itself rejects an UPDATE against a published version row", async () => {
    const version = await getLatestVersion(workspaceId, agentId);
    expect(version).not.toBeNull();

    // Scoped through withScope (sets app.workspace_id), same as every real
    // write in this codebase -- an unscoped query wouldn't even match the
    // row under RLS, which would make this pass for the wrong reason (zero
    // rows updated, trigger never fires) rather than proving the trigger
    // itself rejects a real, RLS-visible write.
    let thrown: unknown;
    try {
      await withScope({ workspaceId }, (tx) =>
        tx.update(agentVersions).set({ note: "hacked" }).where(eq(agentVersions.id, version!.id)),
      );
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toMatch(/immutable/i);
  });

  // DELETE is deliberately not guarded (migration 0008): `agent_versions`
  // cascades on its parent agent/workspace being deleted, and the original
  // UPDATE-or-DELETE trigger (0006) blocked that cascade too, failing an
  // agent/workspace deletion outright the moment it owned any published
  // version -- discovered by this very file's own `afterAll` cleanup
  // tripping over it. "Immutable" is about preventing a published
  // snapshot from being rewritten, not about outliving the agent it
  // belongs to.
  it("does not block a cascaded delete when the owning agent is removed", async () => {
    const version = await getLatestVersion(workspaceId, agentId);
    expect(version).not.toBeNull();

    await withScope({ workspaceId }, (tx) => tx.delete(agents).where(eq(agents.id, agentId)));

    const remaining = await withScope({ workspaceId }, (tx) =>
      tx.select().from(agentVersions).where(eq(agentVersions.id, version!.id)),
    );
    expect(remaining).toHaveLength(0);
  });
});
