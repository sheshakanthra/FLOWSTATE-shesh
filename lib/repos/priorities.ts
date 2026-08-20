import { and, desc, eq, isNull } from "drizzle-orm";
import { agents, priorityItems, users, type prioritySeverityEnum } from "@/db/schema";
import { listRuns } from "./runs";
import { withScope } from "./db";

export type PrioritySeverity = (typeof prioritySeverityEnum.enumValues)[number];
export type PriorityItemType =
  | "failed_run"
  | "human_approval"
  | "declining_success_rate"
  | "stale_draft"
  | "cost_spike";

export interface PriorityItemRecord {
  id: string;
  title: string;
  description: string | null;
  severity: PrioritySeverity;
  itemType: PriorityItemType;
  sourceType: string;
  sourceId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  resolved: boolean;
  magnitude: number;
  entitySignal: number;
  snoozedUntil: Date | null;
  createdAt: Date;
}

function toRecord(row: {
  id: string;
  title: string;
  description: string | null;
  severity: PrioritySeverity;
  itemType: string;
  sourceType: string;
  sourceId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  resolved: boolean;
  magnitude: string;
  entitySignal: string;
  snoozedUntil: Date | null;
  createdAt: Date;
}): PriorityItemRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    severity: row.severity,
    itemType: row.itemType as PriorityItemType,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    assigneeId: row.assigneeId,
    assigneeName: row.assigneeName,
    resolved: row.resolved,
    magnitude: Number(row.magnitude),
    entitySignal: Number(row.entitySignal),
    snoozedUntil: row.snoozedUntil,
    createdAt: row.createdAt,
  };
}

const COLUMNS = {
  id: priorityItems.id,
  title: priorityItems.title,
  description: priorityItems.description,
  severity: priorityItems.severity,
  itemType: priorityItems.itemType,
  sourceType: priorityItems.sourceType,
  sourceId: priorityItems.sourceId,
  assigneeId: priorityItems.assigneeId,
  assigneeName: users.name,
  resolved: priorityItems.resolved,
  magnitude: priorityItems.magnitude,
  entitySignal: priorityItems.entitySignal,
  snoozedUntil: priorityItems.snoozedUntil,
  createdAt: priorityItems.createdAt,
};

/**
 * The queue's one data source (gate item 3: "full paint under 800ms with
 * 500 priority items"). A single indexed query (`priority_items_workspace_id_resolved_idx`)
 * returning already-materialized ranking inputs -- no join against
 * `agents`/`agent_runs` to figure out what's currently wrong, because
 * that's exactly the per-request computation the spec's own Notes warn
 * kills the budget at real data volume. Resolved items are excluded here
 * (spec item 5: "resolved collapses out"); snoozed-but-not-yet-due items
 * are *not* excluded -- they're still real, visible rows, just dimmed
 * (row.tsx), so filtering them out here would mean the queue can't show
 * "returns at 3pm" for something the user hasn't seen yet today.
 */
export async function listPriorityItems(workspaceId: string): Promise<PriorityItemRecord[]> {
  const rows = await withScope({ workspaceId }, (tx) =>
    tx
      .select(COLUMNS)
      .from(priorityItems)
      .leftJoin(users, eq(users.id, priorityItems.assigneeId))
      .where(and(eq(priorityItems.workspaceId, workspaceId), eq(priorityItems.resolved, false)))
      .orderBy(desc(priorityItems.createdAt)),
  );
  return rows.map(toRecord);
}

export async function getPriorityItem(workspaceId: string, id: string): Promise<PriorityItemRecord | null> {
  const [row] = await withScope({ workspaceId }, (tx) =>
    tx
      .select(COLUMNS)
      .from(priorityItems)
      .leftJoin(users, eq(users.id, priorityItems.assigneeId))
      .where(and(eq(priorityItems.workspaceId, workspaceId), eq(priorityItems.id, id)))
      .limit(1),
  );
  return row ? toRecord(row) : null;
}

/** Gate item 6's `e` (resolve) and its own ⌘Z undo (gate item 5) -- both go
 *  through this, just with the opposite boolean. */
export async function setPriorityItemResolved(workspaceId: string, id: string, resolved: boolean): Promise<PriorityItemRecord | null> {
  const [row] = await withScope({ workspaceId }, (tx) =>
    tx
      .update(priorityItems)
      .set({ resolved })
      .where(and(eq(priorityItems.id, id), eq(priorityItems.workspaceId, workspaceId)))
      .returning(),
  );
  if (!row) return null;
  return getPriorityItem(workspaceId, row.id);
}

/** Snooze (a real `Date`) and its undo (`null`) -- gate items 5 and 7. */
export async function setPriorityItemSnoozedUntil(workspaceId: string, id: string, snoozedUntil: Date | null): Promise<PriorityItemRecord | null> {
  const [row] = await withScope({ workspaceId }, (tx) =>
    tx
      .update(priorityItems)
      .set({ snoozedUntil })
      .where(and(eq(priorityItems.id, id), eq(priorityItems.workspaceId, workspaceId)))
      .returning(),
  );
  if (!row) return null;
  return getPriorityItem(workspaceId, row.id);
}

/** Delegate and its undo (revert to whatever `assigneeId` was captured
 *  client-side before the delegate call, or `null`). */
export async function setPriorityItemAssignee(workspaceId: string, id: string, assigneeId: string | null): Promise<PriorityItemRecord | null> {
  const [row] = await withScope({ workspaceId }, (tx) =>
    tx
      .update(priorityItems)
      .set({ assigneeId })
      .where(and(eq(priorityItems.id, id), eq(priorityItems.workspaceId, workspaceId)))
      .returning(),
  );
  if (!row) return null;
  return getPriorityItem(workspaceId, row.id);
}

export interface MaterializeInput {
  itemType: PriorityItemType;
  sourceType: string;
  sourceId: string | null;
  title: string;
  description: string | null;
  severity: PrioritySeverity;
  magnitude: number;
  entitySignal: number;
}

/**
 * "Materialized on event, not computed per request" (spec Notes). Upserts
 * by `(itemType, sourceId)` among *unresolved* rows -- a second consecutive
 * failure updates the existing item's magnitude/severity in place rather
 * than spamming a new row per run, which is both the honest "still the same
 * ongoing problem" model and what keeps the table from growing unbounded.
 */
async function upsertPriorityItem(workspaceId: string, input: MaterializeInput): Promise<void> {
  await withScope({ workspaceId }, async (tx) => {
    const sourceCondition = input.sourceId ? eq(priorityItems.sourceId, input.sourceId) : isNull(priorityItems.sourceId);
    const [existing] = await tx
      .select({ id: priorityItems.id })
      .from(priorityItems)
      .where(and(eq(priorityItems.workspaceId, workspaceId), eq(priorityItems.itemType, input.itemType), sourceCondition, eq(priorityItems.resolved, false)))
      .limit(1);

    if (existing) {
      await tx
        .update(priorityItems)
        .set({
          title: input.title,
          description: input.description,
          severity: input.severity,
          magnitude: input.magnitude.toFixed(4),
          entitySignal: input.entitySignal.toFixed(4),
        })
        .where(eq(priorityItems.id, existing.id));
      return;
    }

    await tx.insert(priorityItems).values({
      workspaceId,
      itemType: input.itemType,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      title: input.title,
      description: input.description,
      severity: input.severity,
      magnitude: input.magnitude.toFixed(4),
      entitySignal: input.entitySignal.toFixed(4),
      resolved: false,
    });
  });
}

/** The self-correcting half of materialization: a condition that's no
 *  longer true resolves its own item automatically, the same way a person
 *  resolving it by hand would. */
async function resolveIfExists(workspaceId: string, itemType: PriorityItemType, sourceId: string | null): Promise<void> {
  await withScope({ workspaceId }, async (tx) => {
    const sourceCondition = sourceId ? eq(priorityItems.sourceId, sourceId) : isNull(priorityItems.sourceId);
    await tx
      .update(priorityItems)
      .set({ resolved: true })
      .where(and(eq(priorityItems.workspaceId, workspaceId), eq(priorityItems.itemType, itemType), sourceCondition, eq(priorityItems.resolved, false)));
  });
}

const RECENT_WINDOW_DAYS = 7;
const DECLINE_THRESHOLD_POINTS = 15;
const COST_SPIKE_THRESHOLD_PERCENT = 50;
const MIN_BASELINE_COST_CENTS = 5;

function severityForFailureStreak(consecutiveFailures: number): PrioritySeverity {
  if (consecutiveFailures >= 5) return "critical";
  if (consecutiveFailures >= 3) return "high";
  return "medium";
}

function severityForDecline(pointsDropped: number): PrioritySeverity {
  if (pointsDropped >= 40) return "critical";
  if (pointsDropped >= 25) return "high";
  return "medium";
}

function severityForCostSpike(percentIncrease: number): PrioritySeverity {
  if (percentIncrease >= 200) return "critical";
  if (percentIncrease >= 100) return "high";
  return "medium";
}

/**
 * Called right after a run finishes (app/api/agents/[id]/run/route.ts, both
 * its success and failure paths) -- the real "on event" hook the spec's
 * Notes ask for, covering three of the five item types from one place:
 * a fresh failure (or a streak ending), a success-rate decline, and a cost
 * spike, all derived from this one agent's own recent run history
 * (`listRuns`, already ordered newest-first, no extra query shape needed).
 * `human_approval` and `stale_draft` are not covered here -- see
 * PROGRESS.md's own Decisions entry for why (no real human-in-loop
 * pause/resume exists yet, and staleness needs a time-based sweep this
 * session doesn't have a scheduler for).
 */
export async function syncAgentPriorityItems(workspaceId: string, agentId: string): Promise<void> {
  const [agent] = await withScope({ workspaceId }, (tx) => tx.select({ name: agents.name }).from(agents).where(eq(agents.id, agentId)).limit(1));
  if (!agent) return;

  const runs = await listRuns(workspaceId, agentId);
  const finished = runs.filter((run) => run.status === "succeeded" || run.status === "failed");

  // ---- failed_run: a streak of consecutive failures, most recent first ----
  let consecutiveFailures = 0;
  for (const run of finished) {
    if (run.status === "failed") consecutiveFailures += 1;
    else break;
  }
  const recentRunCount = runs.filter((run) => run.startedAt.getTime() >= Date.now() - RECENT_WINDOW_DAYS * 24 * 3_600_000).length;

  if (consecutiveFailures > 0) {
    const lastFailure = finished[0];
    await upsertPriorityItem(workspaceId, {
      itemType: "failed_run",
      sourceType: "agent",
      sourceId: agentId,
      title: consecutiveFailures === 1 ? `${agent.name} run failed` : `${agent.name} has failed ${consecutiveFailures} times in a row`,
      description: lastFailure?.errorMessage ?? null,
      severity: severityForFailureStreak(consecutiveFailures),
      magnitude: consecutiveFailures,
      entitySignal: recentRunCount,
    });
  } else {
    await resolveIfExists(workspaceId, "failed_run", agentId);
  }

  // ---- declining_success_rate: last 10 vs the 10 before that ----
  const recentTen = finished.slice(0, 10);
  const priorTen = finished.slice(10, 20);
  if (recentTen.length >= 5 && priorTen.length >= 5) {
    const recentRate = recentTen.filter((run) => run.status === "succeeded").length / recentTen.length;
    const priorRate = priorTen.filter((run) => run.status === "succeeded").length / priorTen.length;
    const pointsDropped = (priorRate - recentRate) * 100;

    if (pointsDropped >= DECLINE_THRESHOLD_POINTS) {
      await upsertPriorityItem(workspaceId, {
        itemType: "declining_success_rate",
        sourceType: "agent",
        sourceId: agentId,
        title: `${agent.name}'s success rate dropped ${Math.round(pointsDropped)} points`,
        description: `${Math.round(priorRate * 100)}% → ${Math.round(recentRate * 100)}% over its last ${recentTen.length} runs.`,
        severity: severityForDecline(pointsDropped),
        magnitude: pointsDropped,
        entitySignal: recentRunCount,
      });
    } else {
      await resolveIfExists(workspaceId, "declining_success_rate", agentId);
    }
  }

  // ---- cost_spike: last 7 days vs the 7 days before that ----
  const now = Date.now();
  const recentWindowStart = now - RECENT_WINDOW_DAYS * 24 * 3_600_000;
  const priorWindowStart = now - 2 * RECENT_WINDOW_DAYS * 24 * 3_600_000;
  let recentCostCents = 0;
  let priorCostCents = 0;
  for (const run of runs) {
    const costCents = (run.costUsd ?? 0) * 100;
    const startedAt = run.startedAt.getTime();
    if (startedAt >= recentWindowStart) recentCostCents += costCents;
    else if (startedAt >= priorWindowStart) priorCostCents += costCents;
  }

  if (priorCostCents >= MIN_BASELINE_COST_CENTS) {
    const percentIncrease = ((recentCostCents - priorCostCents) / priorCostCents) * 100;
    if (percentIncrease >= COST_SPIKE_THRESHOLD_PERCENT) {
      await upsertPriorityItem(workspaceId, {
        itemType: "cost_spike",
        sourceType: "agent",
        sourceId: agentId,
        title: `${agent.name}'s cost is up ${Math.round(percentIncrease)}% this week`,
        description: `$${(priorCostCents / 100).toFixed(2)} → $${(recentCostCents / 100).toFixed(2)} over the last ${RECENT_WINDOW_DAYS} days.`,
        severity: severityForCostSpike(percentIncrease),
        magnitude: percentIncrease,
        entitySignal: recentCostCents,
      });
    } else {
      await resolveIfExists(workspaceId, "cost_spike", agentId);
    }
  }
}

/** Used only by `db/seed.ts` and this file's own upsert helper, exposed so
 *  the seed script's `human_approval`/`stale_draft` rows (not covered by
 *  `syncAgentPriorityItems` -- see its own doc comment) are written through
 *  the same real path a materialized row would be, not a hand-rolled insert. */
export async function materializePriorityItem(workspaceId: string, input: MaterializeInput): Promise<void> {
  await upsertPriorityItem(workspaceId, input);
}

