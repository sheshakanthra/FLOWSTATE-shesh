import type { PriorityItemType } from "./item-types";

export type PrioritySeverity = "critical" | "high" | "medium" | "low";

/**
 * What `computeScore` needs -- the raw, already-materialized inputs
 * (db/schema.ts's `priority_items.magnitude`/`entity_signal`, its own
 * `severity`, and `createdAt`), never a live agent/run lookup. Materializing
 * these onto the row (lib/repos/priorities.ts) rather than joining at read
 * time is what the spec's own Notes call out as necessary for the 800ms
 * budget at 500 items.
 */
export interface PriorityItemFactors {
  itemType: PriorityItemType;
  severity: PrioritySeverity;
  createdAt: Date;
  /** Type-specific magnitude -- consecutive failures, days overdue, points
   *  of success-rate decline, percent cost increase, queue depth. See
   *  `item-types.ts`'s `magnitudeLabel` for what it means per type. */
  magnitude: number;
  /** How much the underlying agent/entity matters -- recent run volume or
   *  cost is what `lib/repos/priorities.ts` materializes here. 0 for an
   *  item with no clear entity signal (a workspace-wide "system" item). */
  entitySignal: number;
}

export interface ScoreBreakdown {
  blastRadius: number;
  timeDecay: number;
  entityValue: number;
  /** `blastRadius * timeDecay * entityValue`, exactly -- the score
   *  explainer (gate item 2) shows all four numbers so the multiplication
   *  is checkable by eye, not just asserted here. */
  score: number;
}

/**
 * Every tunable number the ranking formula uses, in one place (spec item
 * 2's "weights in one exported constant") -- a future session tuning how
 * urgent a cost spike feels relative to a failed run changes exactly one
 * number here, never a magic literal buried in `computeBlastRadius` or
 * `computeTimeDecay`.
 */
export const RANK_WEIGHTS = {
  severityBase: { critical: 4, high: 3, medium: 2, low: 1 } as Record<PrioritySeverity, number>,
  /** Blast radius per unit of `magnitude`, on top of the severity base. */
  magnitudeWeight: 0.5,
  /** Hours until time decay drops to half its starting value. */
  halfLifeHours: 24,
  /** Time decay's floor -- an item that's sat unresolved for a long time
   *  still ranks somewhere in the queue; it doesn't mathematically vanish. */
  decayFloor: 0.15,
  /** entityValue = 1 + log2(1 + entitySignal) * this. log-scaled so one
   *  agent running 500x more than another doesn't dominate the queue
   *  outright -- entityValue grows, just slowly. */
  entitySignalWeight: 0.35,
} as const;

/** Severity plus magnitude -- how much this item's underlying problem
 *  actually affects the business. Clamped to a non-negative magnitude: a
 *  malformed or zero-value entity (spec's own "zero-value entities" gate
 *  scenario) still gets a real, positive blast radius from severity alone. */
export function computeBlastRadius(factors: Pick<PriorityItemFactors, "severity" | "magnitude">): number {
  return RANK_WEIGHTS.severityBase[factors.severity] + Math.max(0, factors.magnitude) * RANK_WEIGHTS.magnitudeWeight;
}

/** Exponential decay from `createdAt`, floored so nothing fully disappears.
 *  A `createdAt` in the future (clock skew, a bad row) clamps to hours=0
 *  (decay=1) rather than producing a decay above 1. */
export function computeTimeDecay(createdAt: Date, now: Date): number {
  const hours = Math.max(0, (now.getTime() - createdAt.getTime()) / 3_600_000);
  const decay = Math.pow(0.5, hours / RANK_WEIGHTS.halfLifeHours);
  return Math.max(RANK_WEIGHTS.decayFloor, decay);
}

/** log-scaled so entityValue is always >= 1 -- an item with zero measurable
 *  entity signal (spec's "zero-value entities") still counts fully for its
 *  own blast radius and recency, it just doesn't get an entity-value boost
 *  on top. */
export function computeEntityValue(factors: Pick<PriorityItemFactors, "entitySignal">): number {
  return 1 + Math.log2(1 + Math.max(0, factors.entitySignal)) * RANK_WEIGHTS.entitySignalWeight;
}

export function computeScore(factors: PriorityItemFactors, now: Date = new Date()): ScoreBreakdown {
  const blastRadius = computeBlastRadius(factors);
  const timeDecay = computeTimeDecay(factors.createdAt, now);
  const entityValue = computeEntityValue(factors);
  return { blastRadius, timeDecay, entityValue, score: blastRadius * timeDecay * entityValue };
}

/**
 * Sorts descending by score. Ties (spec's own gate scenario) break by
 * recency (newer first -- a freshly-created duplicate condition should
 * surface before an equally-scored stale one), then by id for a fully
 * deterministic order across renders and servers.
 */
export function rankPriorityItems<T extends PriorityItemFactors & { id: string }>(
  items: readonly T[],
  now: Date = new Date(),
): (T & { scoreBreakdown: ScoreBreakdown })[] {
  return items
    .map((item) => ({ ...item, scoreBreakdown: computeScore(item, now) }))
    .sort((a, b) => {
      if (b.scoreBreakdown.score !== a.scoreBreakdown.score) return b.scoreBreakdown.score - a.scoreBreakdown.score;
      if (b.createdAt.getTime() !== a.createdAt.getTime()) return b.createdAt.getTime() - a.createdAt.getTime();
      return a.id.localeCompare(b.id);
    });
}
