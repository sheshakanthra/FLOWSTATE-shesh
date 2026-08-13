import { desc, eq, inArray, sql } from "drizzle-orm";
import type { Viewport } from "@xyflow/react";
import { agentRuns, agentVersions, agents, users } from "@/db/schema";
import { withScope } from "./db";

export type AgentStatus = "draft" | "published" | "failing" | "archived";

export interface AgentRecord {
  id: string;
  workspaceId: string;
  name: string;
  status: AgentStatus;
}

/**
 * Deliberately filters only on `id`, not `workspaceId` — the workspace
 * isolation comes entirely from RLS (via withScope's `app.workspace_id`
 * session variable), not from an app-level WHERE clause. That's the
 * property db/schema.test.ts's RLS proof exercises: calling this with the
 * *wrong* workspaceId for a real agent id must return null, because the
 * database itself hides the row, not because this function happened to
 * filter it out.
 */
export async function getAgentById(workspaceId: string, agentId: string): Promise<AgentRecord | null> {
  const [agent] = await withScope({ workspaceId }, (tx) =>
    tx
      .select({
        id: agents.id,
        workspaceId: agents.workspaceId,
        name: agents.name,
        status: agents.status,
      })
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1),
  );
  return agent ?? null;
}

/** Minimal shape persisted in `agents.graph_jsonb` -- a plain nodes/edges
 *  pair, not @xyflow/react's own `Node`/`Edge` types directly, since those
 *  carry client-only fields (`selected`, `dragging`) this never needs to
 *  round-trip. `unknown` at rest: features/agents/lib/persist.ts is the one
 *  place that knows the real node/edge shape and validates it on the way in
 *  and out, matching "no business logic in lib/repos" -- this file has no
 *  opinion on what a node looks like. */
export interface AgentGraphPayload {
  nodes: unknown[];
  edges: unknown[];
}

export interface AgentDetailRecord extends AgentRecord {
  description: string | null;
  graph: AgentGraphPayload | null;
  viewport: Viewport | null;
  updatedAt: Date;
}

export async function getAgentDetail(workspaceId: string, agentId: string): Promise<AgentDetailRecord | null> {
  const [agent] = await withScope({ workspaceId }, (tx) =>
    tx
      .select({
        id: agents.id,
        workspaceId: agents.workspaceId,
        name: agents.name,
        description: agents.description,
        status: agents.status,
        graphJsonb: agents.graphJsonb,
        viewportJsonb: agents.viewportJsonb,
        updatedAt: agents.updatedAt,
      })
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1),
  );
  if (!agent) return null;
  return {
    id: agent.id,
    workspaceId: agent.workspaceId,
    name: agent.name,
    description: agent.description,
    status: agent.status,
    graph: (agent.graphJsonb as AgentGraphPayload | null) ?? null,
    viewport: (agent.viewportJsonb as Viewport | null) ?? null,
    updatedAt: agent.updatedAt,
  };
}

export interface AgentUpdatePatch {
  name?: string;
  description?: string;
  graph?: AgentGraphPayload;
  viewport?: Viewport;
  status?: AgentStatus;
}

/** Partial update behind one endpoint (`app/api/agents/[id]/route.ts`) for
 *  both the debounced graph autosave and the Inspector's agent-settings
 *  form -- only the keys present in `patch` are written. Returns null (not
 *  a thrown error) when RLS hides the row, e.g. `agentId` belongs to a
 *  different workspace than `workspaceId` scopes -- the route maps that to
 *  a 404, the same "the database itself hides the row" property
 *  getAgentById's own doc comment describes. */
export async function updateAgent(
  workspaceId: string,
  agentId: string,
  patch: AgentUpdatePatch,
): Promise<{ updatedAt: Date } | null> {
  const values: Partial<typeof agents.$inferInsert> = { updatedAt: new Date() };
  if (patch.name !== undefined) values.name = patch.name;
  if (patch.description !== undefined) values.description = patch.description;
  if (patch.graph !== undefined) values.graphJsonb = patch.graph;
  if (patch.viewport !== undefined) values.viewportJsonb = patch.viewport;
  if (patch.status !== undefined) values.status = patch.status;

  const [updated] = await withScope({ workspaceId }, (tx) =>
    tx.update(agents).set(values).where(eq(agents.id, agentId)).returning({ updatedAt: agents.updatedAt }),
  );
  return updated ?? null;
}

export interface CreateAgentInput {
  name: string;
  description?: string;
  graph: AgentGraphPayload;
  viewport?: Viewport;
  createdBy: string | null;
  status?: AgentStatus;
}

/**
 * The one low-level "insert a new agent row" primitive -- every path that
 * creates an agent (a template from the gallery, importing exported JSON)
 * goes through this rather than each constructing its own INSERT, so
 * "what does a freshly created agent look like" has one definition. Always
 * starts life as a draft (unless a caller explicitly says otherwise) with
 * no `agent_versions` row -- a brand-new agent has no publish history yet,
 * which is the correct, honest starting state, not an oversight.
 */
export async function createAgent(workspaceId: string, input: CreateAgentInput): Promise<AgentDetailRecord> {
  const [inserted] = await withScope({ workspaceId }, (tx) =>
    tx
      .insert(agents)
      .values({
        workspaceId,
        name: input.name,
        description: input.description ?? null,
        status: input.status ?? "draft",
        createdBy: input.createdBy,
        graphJsonb: input.graph as unknown as object,
        viewportJsonb: (input.viewport ?? null) as unknown as object | null,
      })
      .returning(),
  );
  if (!inserted) throw new Error("agent insert failed");
  return {
    id: inserted.id,
    workspaceId: inserted.workspaceId,
    name: inserted.name,
    status: inserted.status,
    description: inserted.description,
    graph: inserted.graphJsonb as AgentGraphPayload,
    viewport: inserted.viewportJsonb as Viewport | null,
    updatedAt: inserted.updatedAt,
  };
}

/**
 * Session spec item 7: "Duplicate an agent." A new, independent agent with
 * the source's current draft graph copied in -- not a reference, not a
 * shared version history (the duplicate's own `agent_versions` starts
 * empty, same as any newly created agent; publishing the original again
 * never affects the copy and vice versa). Reads and writes in the same
 * `withScope` transaction so the copy reflects one consistent instant of
 * the source, not a source that could have been edited between an initial
 * read and a later write.
 */
export async function duplicateAgent(
  workspaceId: string,
  agentId: string,
  createdBy: string | null,
): Promise<AgentDetailRecord | null> {
  return withScope({ workspaceId }, async (tx) => {
    const [source] = await tx.select().from(agents).where(eq(agents.id, agentId)).limit(1);
    if (!source) return null;

    const [inserted] = await tx
      .insert(agents)
      .values({
        workspaceId,
        name: `${source.name} (copy)`,
        description: source.description,
        status: "draft",
        createdBy,
        graphJsonb: source.graphJsonb,
        viewportJsonb: source.viewportJsonb,
      })
      .returning();
    if (!inserted) throw new Error("agent duplicate insert failed");

    return {
      id: inserted.id,
      workspaceId: inserted.workspaceId,
      name: inserted.name,
      status: inserted.status,
      description: inserted.description,
      graph: inserted.graphJsonb as AgentGraphPayload,
      viewport: inserted.viewportJsonb as Viewport | null,
      updatedAt: inserted.updatedAt,
    };
  });
}

/** Session spec item 8's "bulk enable/disable" -- one UPDATE for the whole
 *  selection, not N. `inArray` with an empty array is a valid no-op query
 *  in Drizzle/Postgres (matches zero rows), so callers don't need to guard
 *  against an empty selection themselves. */
export async function bulkSetEnabled(workspaceId: string, agentIds: string[], enabled: boolean): Promise<void> {
  if (agentIds.length === 0) return;
  await withScope({ workspaceId }, (tx) =>
    tx
      .update(agents)
      .set({ enabled, updatedAt: new Date() })
      .where(inArray(agents.id, agentIds)),
  );
}

export interface AgentIndexRow {
  id: string;
  name: string;
  status: AgentStatus;
  enabled: boolean;
  latestVersion: number | null;
  lastRunStatus: "running" | "succeeded" | "failed" | "cancelled" | null;
  lastRunAt: Date | null;
  /** 0-1, or null when the agent has never run. */
  successRate: number | null;
  costLast7DaysUsd: number;
  ownerName: string | null;
  updatedAt: Date;
}

/**
 * Session spec item 8: the agents index `DataTable`'s data source --
 * name/status/version/last run/success rate/cost last 7 days/owner, all in
 * one query (four correlated per-row subqueries, each backed by the
 * `agent_runs(agent_id, started_at)` index from this session's own
 * migration, or the `agent_versions` table's existing unique-constraint
 * index) rather than N+1 round trips, which is what "stays responsive with
 * 500 agents" (gate item 8) actually depends on structurally.
 */
export async function listAgentsForIndex(workspaceId: string): Promise<AgentIndexRow[]> {
  const rows = await withScope({ workspaceId }, (tx) =>
    tx
      .select({
        id: agents.id,
        name: agents.name,
        status: agents.status,
        enabled: agents.enabled,
        updatedAt: agents.updatedAt,
        ownerName: users.name,
        latestVersion: sql<number | null>`(
          select max(${agentVersions.version}) from ${agentVersions}
          where ${agentVersions.agentId} = ${agents.id}
        )`,
        lastRunStatus: sql<string | null>`(
          select ${agentRuns.status} from ${agentRuns}
          where ${agentRuns.agentId} = ${agents.id}
          order by ${agentRuns.startedAt} desc limit 1
        )`,
        lastRunAt: sql<Date | null>`(
          select ${agentRuns.startedAt} from ${agentRuns}
          where ${agentRuns.agentId} = ${agents.id}
          order by ${agentRuns.startedAt} desc limit 1
        )`,
        successRate: sql<number | null>`(
          select case when count(*) = 0 then null
            else count(*) filter (where ${agentRuns.status} = 'succeeded')::float / count(*)
          end
          from ${agentRuns} where ${agentRuns.agentId} = ${agents.id}
        )`,
        costLast7DaysUsd: sql<number>`coalesce((
          select sum(${agentRuns.costUsd}) from ${agentRuns}
          where ${agentRuns.agentId} = ${agents.id}
            and ${agentRuns.startedAt} >= now() - interval '7 days'
        ), 0)`,
      })
      .from(agents)
      .leftJoin(users, eq(users.id, agents.createdBy))
      .where(eq(agents.workspaceId, workspaceId))
      .orderBy(desc(agents.updatedAt)),
  );

  return rows.map((row) => ({
    ...row,
    lastRunStatus: row.lastRunStatus as AgentIndexRow["lastRunStatus"],
    // A raw `sql<Date | null>`-typed subquery only tells TypeScript what
    // shape to expect -- postgres.js doesn't run its usual column-type
    // parsing on an ad-hoc computed column the way it does for a real
    // `timestamp` column reference, so this comes back as an ISO string at
    // runtime despite its compile-time type. `new Date(...)` makes the
    // runtime value match what every caller (this page, the client table
    // component serializing it back to a string) already assumes.
    lastRunAt: row.lastRunAt ? new Date(row.lastRunAt) : null,
    costLast7DaysUsd: Number(row.costLast7DaysUsd),
  }));
}
