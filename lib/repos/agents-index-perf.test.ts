// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { client, db } from "@/db/client";
import { agentRuns, agents, workspaces } from "@/db/schema";
import { listAgentsForIndex } from "./agents";
import { withScope } from "./db";

/**
 * Gate item 8: "Agents index handles the seeded set and stays responsive
 * with 500 agents." Synthetic, perf-only data in a throwaway workspace
 * (deleted in `afterAll`) -- matching B1's own precedent for this exact
 * class of check (its 300-node/400-edge canvas benchmark data lives only
 * in a Storybook story, never the real seed): 500 fake agents have no
 * place in the curated, narrative seed data `db/seed.ts` produces, but the
 * query this page depends on needs to be proven at this scale somewhere.
 */
describe("listAgentsForIndex -- gate item 8 (500 agents)", () => {
  let workspaceId: string;

  beforeAll(async () => {
    const [workspace] = await db
      .insert(workspaces)
      .values({ name: "Agents Index Perf Test", slug: `agents-index-perf-${crypto.randomUUID()}` })
      .returning();
    workspaceId = workspace!.id;

    const agentRows = Array.from({ length: 500 }, (_, index) => ({
      workspaceId,
      name: `Synthetic Agent ${index}`,
      status: (["draft", "published", "failing", "archived"] as const)[index % 4]!,
    }));
    const insertedAgents = await withScope({ workspaceId }, (tx) =>
      tx.insert(agents).values(agentRows).returning({ id: agents.id }),
    );

    // A handful of runs per agent (not all 500 need runs -- a real
    // workspace has a mix of never-run drafts and heavily-run published
    // agents), so the per-row correlated subqueries actually have rows to
    // aggregate over, not just an index scan over nothing.
    const runRows: (typeof agentRuns.$inferInsert)[] = [];
    for (const [index, agent] of insertedAgents.entries()) {
      if (index % 3 === 0) continue; // a third of agents have never run
      for (let runIndex = 0; runIndex < 5; runIndex++) {
        const startedAt = new Date(Date.now() - runIndex * 60 * 60 * 1000);
        runRows.push({
          workspaceId,
          agentId: agent.id,
          status: runIndex % 4 === 0 ? "failed" : "succeeded",
          trigger: "manual",
          startedAt,
          finishedAt: startedAt,
          durationMs: 1000,
          costUsd: "0.0010",
          inputTokens: 100,
          outputTokens: 50,
        });
      }
    }
    await withScope({ workspaceId }, (tx) => tx.insert(agentRuns).values(runRows));
  }, 60_000);

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    await client.end();
  });

  it("returns all 500 agents with correct aggregates, well within a responsive time budget", async () => {
    const start = performance.now();
    const rows = await listAgentsForIndex(workspaceId);
    const elapsedMs = performance.now() - start;

    expect(rows).toHaveLength(500);

    // A row that had 5 runs (runIndex 0-4), failed on runIndex 0 and 4
    // (`runIndex % 4 === 0`): success rate is 3/5.
    const ranRow = rows.find((row) => row.lastRunStatus !== null);
    expect(ranRow).toBeDefined();
    expect(ranRow!.successRate).toBeCloseTo(0.6, 5);
    // A real `Date`, not the raw ISO string postgres.js returns for a
    // computed `sql<Date>` subquery -- caught the hard way once already
    // (the agents index page crashed calling `.toISOString()` on this
    // before `listAgentsForIndex` converted it explicitly).
    expect(ranRow!.lastRunAt).toBeInstanceOf(Date);

    // A row that never ran reports it honestly, not as a 0% failure.
    const neverRanRow = rows.find((row) => row.lastRunStatus === null);
    expect(neverRanRow).toBeDefined();
    expect(neverRanRow!.successRate).toBeNull();

    // Generous, but real: a single query with four correlated subqueries
    // over 500 agents / ~1600 runs, backed by this session's own
    // agent_runs(agent_id, started_at) index, should stay well under a
    // second on any real hardware this app runs on -- this is the
    // structural property "stays responsive" rests on; DataTable's own
    // virtualization (proven at 50,000 rows in A5) handles the render side.
    expect(elapsedMs).toBeLessThan(2000);
  });
});
