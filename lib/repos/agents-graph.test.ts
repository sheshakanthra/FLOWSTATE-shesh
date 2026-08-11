// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { client, db } from "@/db/client";
import { agents, workspaces } from "@/db/schema";
import { getAgentDetail, updateAgent } from "./agents";
import { withScope } from "./db";

/**
 * B3's persistence layer: `updateAgent` writes `graph_jsonb`/`viewport_jsonb`
 * (and, separately, name/description), and `getAgentDetail` reads them back
 * -- the round trip page.tsx's server load and the debounced autosave PATCH
 * both depend on. A separate file (not an addition to agents.test.ts) so its
 * own `client.end()` in `afterAll` can't race a sibling describe block's
 * tests in the same file.
 */
describe("updateAgent / getAgentDetail", () => {
  let workspaceId: string;
  let agentId: string;

  beforeAll(async () => {
    const [workspace] = await db
      .insert(workspaces)
      .values({ name: "Agent Graph Test", slug: `agent-graph-test-${crypto.randomUUID()}` })
      .returning();
    workspaceId = workspace!.id;

    const [agent] = await withScope({ workspaceId }, (tx) =>
      tx.insert(agents).values({ workspaceId, name: "Untitled agent", status: "draft" }).returning(),
    );
    agentId = agent!.id;
  });

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    await client.end();
  });

  it("starts with no graph/viewport persisted", async () => {
    const detail = await getAgentDetail(workspaceId, agentId);
    expect(detail?.graph).toBeNull();
    expect(detail?.viewport).toBeNull();
  });

  it("round-trips a saved graph and viewport", async () => {
    const graph = {
      nodes: [{ id: "node-1", type: "trigger", position: { x: 10, y: 20 }, data: { label: "Trigger", config: {} } }],
      edges: [],
    };
    const viewport = { x: 5, y: 6, zoom: 1.5 };

    const result = await updateAgent(workspaceId, agentId, { graph, viewport });
    expect(result).not.toBeNull();

    const detail = await getAgentDetail(workspaceId, agentId);
    expect(detail?.graph).toEqual(graph);
    expect(detail?.viewport).toEqual(viewport);
  });

  it("only writes the fields present in the patch", async () => {
    await updateAgent(workspaceId, agentId, { name: "Renamed agent" });
    const detail = await getAgentDetail(workspaceId, agentId);
    expect(detail?.name).toBe("Renamed agent");
    // The graph written by the previous test must survive an update that
    // never mentions `graph` -- proves the repo only sets columns present
    // in the patch, not a full-row overwrite that would null out the rest.
    expect(detail?.graph).not.toBeNull();
  });

  it("returns null when the agent belongs to a different workspace (RLS)", async () => {
    const [otherWorkspace] = await db
      .insert(workspaces)
      .values({ name: "Other workspace", slug: `other-workspace-${crypto.randomUUID()}` })
      .returning();
    const result = await updateAgent(otherWorkspace!.id, agentId, { name: "Hijacked" });
    expect(result).toBeNull();
    await db.delete(workspaces).where(eq(workspaces.id, otherWorkspace!.id));
  });
});
