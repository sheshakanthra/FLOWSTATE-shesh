import { desc, eq, sql } from "drizzle-orm";
import { agentRuns, agentVersions, users } from "@/db/schema";
import { withScope } from "./db";
import type { AgentGraphPayload } from "./agents";

export interface AgentVersionRecord {
  id: string;
  workspaceId: string;
  agentId: string;
  version: number;
  graph: AgentGraphPayload;
  published: boolean;
  note: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: Date;
  /** How many recorded runs point at this exact snapshot
   *  (`agent_runs.agent_version_id`) -- the version history panel's own
   *  gate item ("author, date, note, run count"). Zero for a version
   *  nothing has run against yet, not an error. */
  runCount: number;
}

/**
 * Publishing creates one of these -- an immutable snapshot (gate item 1;
 * enforced at the database layer by `agent_versions_immutable`, the trigger
 * in migration 0006, not just by this function never issuing an UPDATE).
 * The next version number is computed inside the same transaction
 * `withScope` already opens, so a concurrent publish of the same agent
 * can't observe a stale max -- and the table's own
 * `agent_versions_agent_version_unique` constraint is the hard backstop if
 * two requests still race past that.
 */
export async function createVersion(
  workspaceId: string,
  agentId: string,
  graph: AgentGraphPayload,
  options: { createdBy: string | null; note?: string },
): Promise<AgentVersionRecord> {
  return withScope({ workspaceId }, async (tx) => {
    const [row] = await tx
      .select({ max: sql<number>`coalesce(max(${agentVersions.version}), 0)` })
      .from(agentVersions)
      .where(eq(agentVersions.agentId, agentId));
    const nextVersion = (row?.max ?? 0) + 1;

    const [inserted] = await tx
      .insert(agentVersions)
      .values({
        workspaceId,
        agentId,
        version: nextVersion,
        graph: graph as unknown as object,
        published: true,
        createdBy: options.createdBy,
        note: options.note ?? null,
      })
      .returning();
    if (!inserted) throw new Error("agent version insert failed");

    return {
      id: inserted.id,
      workspaceId: inserted.workspaceId,
      agentId: inserted.agentId,
      version: inserted.version,
      graph: inserted.graph as AgentGraphPayload,
      published: inserted.published,
      note: inserted.note,
      createdBy: inserted.createdBy,
      createdByName: null,
      createdAt: inserted.createdAt,
      runCount: 0,
    };
  });
}

/** Every version of one agent, newest first, with author name and run count
 *  joined in -- one query, not N+1, since this backs a list that's meant to
 *  be read in full (a real agent has single-digit-to-low-tens of versions,
 *  not thousands). */
export async function listVersions(workspaceId: string, agentId: string): Promise<AgentVersionRecord[]> {
  const rows = await withScope({ workspaceId }, (tx) =>
    tx
      .select({
        id: agentVersions.id,
        workspaceId: agentVersions.workspaceId,
        agentId: agentVersions.agentId,
        version: agentVersions.version,
        graph: agentVersions.graph,
        published: agentVersions.published,
        note: agentVersions.note,
        createdBy: agentVersions.createdBy,
        createdByName: users.name,
        createdAt: agentVersions.createdAt,
        runCount: sql<number>`(
          select count(*)::int from ${agentRuns}
          where ${agentRuns.agentVersionId} = ${agentVersions.id}
        )`,
      })
      .from(agentVersions)
      .leftJoin(users, eq(users.id, agentVersions.createdBy))
      .where(eq(agentVersions.agentId, agentId))
      .orderBy(desc(agentVersions.version)),
  );
  return rows.map((row) => ({ ...row, graph: row.graph as AgentGraphPayload }));
}

export async function getVersion(
  workspaceId: string,
  agentId: string,
  versionId: string,
): Promise<AgentVersionRecord | null> {
  const [row] = await withScope({ workspaceId }, (tx) =>
    tx
      .select({
        id: agentVersions.id,
        workspaceId: agentVersions.workspaceId,
        agentId: agentVersions.agentId,
        version: agentVersions.version,
        graph: agentVersions.graph,
        published: agentVersions.published,
        note: agentVersions.note,
        createdBy: agentVersions.createdBy,
        createdByName: users.name,
        createdAt: agentVersions.createdAt,
        runCount: sql<number>`(
          select count(*)::int from ${agentRuns}
          where ${agentRuns.agentVersionId} = ${agentVersions.id}
        )`,
      })
      .from(agentVersions)
      .leftJoin(users, eq(users.id, agentVersions.createdBy))
      .where(eq(agentVersions.id, versionId))
      .limit(1),
  );
  if (!row || row.agentId !== agentId) return null;
  return { ...row, graph: row.graph as AgentGraphPayload };
}

export async function getLatestVersion(workspaceId: string, agentId: string): Promise<AgentVersionRecord | null> {
  const [row] = await withScope({ workspaceId }, (tx) =>
    tx
      .select({
        id: agentVersions.id,
        workspaceId: agentVersions.workspaceId,
        agentId: agentVersions.agentId,
        version: agentVersions.version,
        graph: agentVersions.graph,
        published: agentVersions.published,
        note: agentVersions.note,
        createdBy: agentVersions.createdBy,
        createdByName: users.name,
        createdAt: agentVersions.createdAt,
        runCount: sql<number>`(
          select count(*)::int from ${agentRuns}
          where ${agentRuns.agentVersionId} = ${agentVersions.id}
        )`,
      })
      .from(agentVersions)
      .leftJoin(users, eq(users.id, agentVersions.createdBy))
      .where(eq(agentVersions.agentId, agentId))
      .orderBy(desc(agentVersions.version))
      .limit(1),
  );
  if (!row) return null;
  return { ...row, graph: row.graph as AgentGraphPayload };
}
