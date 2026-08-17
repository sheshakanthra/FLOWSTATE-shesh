// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { client, db } from "@/db/client";
import { agentRuns, agents, workspaces } from "@/db/schema";
import { withScope } from "@/lib/repos/db";
import { EMPTY_ENVELOPE } from "../context/envelope";
import { retrieveContext } from "./retrieve";

/**
 * Session spec item 4 / gate item 3's own example ("which agents failed most
 * this week"): retrieval has to find a real failed run against a real
 * database, joined to a real agent name, with an href the client can
 * actually navigate to -- app/(app)/w/[workspace]/agents/[id]/runs/[runId]/page.tsx's
 * real route shape, not an assumed one.
 */
describe("retrieveContext", () => {
  let workspaceId: string;
  let workspaceSlug: string;
  let agentId: string;
  let failedRunId: string;

  beforeAll(async () => {
    workspaceSlug = `retrieve-test-${crypto.randomUUID()}`;
    const [workspace] = await db.insert(workspaces).values({ name: "Retrieve Test", slug: workspaceSlug }).returning();
    workspaceId = workspace!.id;

    const [agent] = await withScope({ workspaceId }, (tx) =>
      tx.insert(agents).values({ workspaceId, name: "Lead Qualifier", status: "published" }).returning(),
    );
    agentId = agent!.id;

    const now = new Date();
    const [failedRun] = await withScope({ workspaceId }, (tx) =>
      tx
        .insert(agentRuns)
        .values({
          workspaceId,
          agentId,
          status: "failed",
          trigger: "manual",
          startedAt: now,
          finishedAt: now,
          errorMessage: "Groq request timed out",
        })
        .returning(),
    );
    failedRunId = failedRun!.id;

    // A run well outside the default lookback window -- proves the date
    // filter actually excludes something, not just that the query runs.
    const longAgo = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    await withScope({ workspaceId }, (tx) =>
      tx.insert(agentRuns).values({
        workspaceId,
        agentId,
        status: "succeeded",
        trigger: "manual",
        startedAt: longAgo,
        finishedAt: longAgo,
      }),
    );
  });

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    await client.end();
  });

  it("finds a recent failed run and produces a navigable citation record", async () => {
    const records = await retrieveContext({
      workspaceId,
      workspaceSlug,
      message: "which agents failed most this week",
      envelope: EMPTY_ENVELOPE,
    });

    const runRecord = records.find((record) => record.id === failedRunId);
    expect(runRecord).toBeDefined();
    expect(runRecord?.type).toBe("run");
    expect(runRecord?.href).toBe(`/w/${workspaceSlug}/agents/${agentId}/runs/${failedRunId}`);
    expect(runRecord?.label).toContain("Lead Qualifier");
    expect(runRecord?.summary).toContain("status: failed");
  });

  it("also includes the agent itself, for questions about agents in aggregate", async () => {
    const records = await retrieveContext({
      workspaceId,
      workspaceSlug,
      message: "which agent costs the most",
      envelope: EMPTY_ENVELOPE,
    });

    const agentRecord = records.find((record) => record.id === agentId);
    expect(agentRecord).toBeDefined();
    expect(agentRecord?.type).toBe("agent");
    expect(agentRecord?.href).toBe(`/w/${workspaceSlug}/agents/${agentId}/build`);
  });

  it("excludes a run outside the inferred date window", async () => {
    const records = await retrieveContext({
      workspaceId,
      workspaceSlug,
      message: "which agents failed most this week",
      envelope: EMPTY_ENVELOPE,
    });
    const runIds = records.filter((record) => record.type === "run").map((record) => record.id);
    expect(runIds).toEqual([failedRunId]);
  });
});
