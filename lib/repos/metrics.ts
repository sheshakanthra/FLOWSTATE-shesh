import { and, desc, eq, gte, or, sql } from "drizzle-orm";
import { agentRuns, agents, activityEvents, runSteps, users, type runStatusEnum } from "@/db/schema";
import { withScope } from "./db";

export type RunStatus = (typeof runStatusEnum.enumValues)[number];

const DAY_MS = 24 * 60 * 60 * 1000;
const SPARKLINE_DAYS = 7;
/** Scope item 1: "recently completed runs" join the in-flight zone
 *  alongside actually-running ones -- long enough to read as "just
 *  happened," short enough that the zone doesn't slowly fill with history
 *  the priority queue / activity rail already cover. */
const RECENT_COMPLETED_WINDOW_MS = 2 * 60 * 1000;

// ---- in-flight zone ----

export interface InFlightRunRecord {
  id: string;
  agentId: string;
  agentName: string;
  status: RunStatus;
  trigger: string;
  startedAt: Date;
  finishedAt: Date | null;
  currentNodeName: string | null;
  currentStepIndex: number | null;
  /** Real, live-accumulating: summed from `run_steps.cost_cents` for this
   *  run as of this read -- not a placeholder that snaps to a final value
   *  once the run finishes. `agent_runs.cost_usd` (used everywhere else in
   *  this codebase) stays null until `finishRun`, which is exactly why it
   *  can't be what this reads. */
  liveCostCents: number;
  errorMessage: string | null;
}

/**
 * Scope item 1's data source. One query, not N+1 per card: a correlated
 * subquery sums each run's own `run_steps` rows, the same shape
 * `lib/repos/agents.ts#listAgentsForIndex` already established for
 * per-row aggregates. Ordered newest-first so a just-started run appears
 * above one that's been running a while.
 */
export async function listInFlightRuns(workspaceId: string): Promise<InFlightRunRecord[]> {
  const since = new Date(Date.now() - RECENT_COMPLETED_WINDOW_MS);
  const rows = await withScope({ workspaceId }, (tx) =>
    tx
      .select({
        id: agentRuns.id,
        agentId: agentRuns.agentId,
        agentName: agents.name,
        status: agentRuns.status,
        trigger: agentRuns.trigger,
        startedAt: agentRuns.startedAt,
        finishedAt: agentRuns.finishedAt,
        currentNodeName: agentRuns.currentNodeName,
        currentStepIndex: agentRuns.currentStepIndex,
        errorMessage: agentRuns.errorMessage,
        liveCostCents: sql<string>`coalesce((
          select sum(${runSteps.costCents}) from ${runSteps}
          where ${runSteps.runId} = ${agentRuns.id}
        ), 0)`,
      })
      .from(agentRuns)
      .innerJoin(agents, eq(agents.id, agentRuns.agentId))
      .where(
        and(
          eq(agentRuns.workspaceId, workspaceId),
          or(eq(agentRuns.status, "running"), gte(agentRuns.finishedAt, since)),
        ),
      )
      .orderBy(desc(agentRuns.startedAt)),
  );
  return rows.map((row) => ({ ...row, liveCostCents: Number(row.liveCostCents) }));
}

// ---- activity rail ----

export interface ActivityEventRecord {
  id: string;
  actorId: string | null;
  actorName: string | null;
  verb: string;
  subjectType: string;
  subjectId: string | null;
  summary: string;
  createdAt: Date;
}

/** Scope item 7's data source -- newest first, capped generously above
 *  gate item 8's "40 events" so `features/today/activity/group.ts` has
 *  real headroom to prove grouping collapses volume, not just avoids it by
 *  under-fetching. */
export async function listRecentActivity(workspaceId: string, limit = 60): Promise<ActivityEventRecord[]> {
  const rows = await withScope({ workspaceId }, (tx) =>
    tx
      .select({
        id: activityEvents.id,
        actorId: activityEvents.actorId,
        actorName: users.name,
        verb: activityEvents.verb,
        subjectType: activityEvents.subjectType,
        subjectId: activityEvents.subjectId,
        summary: activityEvents.summary,
        createdAt: activityEvents.createdAt,
      })
      .from(activityEvents)
      .leftJoin(users, eq(users.id, activityEvents.actorId))
      .where(eq(activityEvents.workspaceId, workspaceId))
      .orderBy(desc(activityEvents.createdAt))
      .limit(limit),
  );
  return rows;
}

// ---- metrics strip ----

export interface MetricsSparklines {
  runsPerDay: number[];
  successRatePerDay: number[];
  spendPerDay: number[];
  activeAgentsPerDay: number[];
}

export interface MetricsRollup {
  runsToday: number;
  /** Over the same 7-day window the sparkline covers -- null (not 0) when
   *  nothing has finished yet, so the UI can render "—" instead of a
   *  misleading 0%. */
  successRate: number | null;
  spendThisWeekUsd: number;
  activeAgents: number;
  sparklines: MetricsSparklines;
}

interface RunForRollup {
  status: RunStatus;
  startedAt: Date;
  costUsd: number | null;
}

interface AgentForRollup {
  enabled: boolean;
  status: string;
  createdAt: Date;
}

/**
 * Pure bucketing over already-fetched rows -- unit-testable without a
 * database, same "keep the arithmetic separate from the query" split as
 * D1's `rank.ts`. `now` is a parameter (not read internally) for the same
 * reason: a test needs to fix it, not race the real clock.
 *
 * Day buckets are UTC calendar days. This workspace has no per-user
 * timezone preference anywhere in the app (sessions carry only a userId --
 * see lib/auth/session.ts), so there is no real timezone to bucket by; UTC
 * is the one deterministic, unambiguous choice available, not a guess at
 * "the" right timezone.
 */
export function computeMetricsRollup(runs: RunForRollup[], agentRows: AgentForRollup[], now: Date): MetricsRollup {
  const todayStartUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const windowStartUtc = todayStartUtc - (SPARKLINE_DAYS - 1) * DAY_MS;

  const runsPerDay = new Array<number>(SPARKLINE_DAYS).fill(0);
  const succeededPerDay = new Array<number>(SPARKLINE_DAYS).fill(0);
  const finishedPerDay = new Array<number>(SPARKLINE_DAYS).fill(0);
  const spendPerDay = new Array<number>(SPARKLINE_DAYS).fill(0);

  for (const run of runs) {
    const dayIndex = Math.floor((run.startedAt.getTime() - windowStartUtc) / DAY_MS);
    if (dayIndex < 0 || dayIndex >= SPARKLINE_DAYS) continue;
    runsPerDay[dayIndex] = (runsPerDay[dayIndex] ?? 0) + 1;
    if (run.status === "succeeded") succeededPerDay[dayIndex] = (succeededPerDay[dayIndex] ?? 0) + 1;
    if (run.status === "succeeded" || run.status === "failed") finishedPerDay[dayIndex] = (finishedPerDay[dayIndex] ?? 0) + 1;
    spendPerDay[dayIndex] = (spendPerDay[dayIndex] ?? 0) + (run.costUsd ?? 0);
  }

  const successRatePerDay = runsPerDay.map((_, index) => (finishedPerDay[index]! > 0 ? succeededPerDay[index]! / finishedPerDay[index]! : 0));

  const isActive = (agent: AgentForRollup) => agent.enabled && agent.status !== "archived";
  const activeAgentsPerDay = Array.from({ length: SPARKLINE_DAYS }, (_, index) => {
    const dayEndUtc = windowStartUtc + (index + 1) * DAY_MS;
    return agentRows.filter((agent) => isActive(agent) && agent.createdAt.getTime() < dayEndUtc).length;
  });

  const totalFinished = finishedPerDay.reduce((sum, value) => sum + value, 0);
  const totalSucceeded = succeededPerDay.reduce((sum, value) => sum + value, 0);

  return {
    runsToday: runsPerDay[SPARKLINE_DAYS - 1] ?? 0,
    successRate: totalFinished > 0 ? totalSucceeded / totalFinished : null,
    spendThisWeekUsd: spendPerDay.reduce((sum, value) => sum + value, 0),
    activeAgents: agentRows.filter(isActive).length,
    sparklines: { runsPerDay, successRatePerDay, spendPerDay, activeAgentsPerDay },
  };
}

export async function getMetricsRollup(workspaceId: string, now: Date = new Date()): Promise<MetricsRollup> {
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (SPARKLINE_DAYS - 1) * DAY_MS);

  const [runs, agentRows] = await withScope({ workspaceId }, async (tx) => {
    const runRows = await tx
      .select({ status: agentRuns.status, startedAt: agentRuns.startedAt, costUsd: agentRuns.costUsd })
      .from(agentRuns)
      .where(and(eq(agentRuns.workspaceId, workspaceId), gte(agentRuns.startedAt, windowStart)));
    const agentsRows = await tx
      .select({ enabled: agents.enabled, status: agents.status, createdAt: agents.createdAt })
      .from(agents)
      .where(eq(agents.workspaceId, workspaceId));
    return [runRows, agentsRows] as const;
  });

  return computeMetricsRollup(
    runs.map((run) => ({ status: run.status, startedAt: run.startedAt, costUsd: run.costUsd !== null ? Number(run.costUsd) : null })),
    agentRows,
    now,
  );
}
