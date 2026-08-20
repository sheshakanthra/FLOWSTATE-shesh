"use client";

import * as React from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn, focusRing } from "@/lib/utils";
import { computeScore, RANK_WEIGHTS, type PriorityItemFactors, type ScoreBreakdown } from "../lib/rank";
import { ITEM_TYPE_META } from "../lib/item-types";

function round(value: number, digits = 2): string {
  return value.toFixed(digits);
}

export interface ScoreExplainerProps {
  factors: PriorityItemFactors;
  now?: Date;
}

/**
 * Session spec item 3 / gate item 2: "shows real factor values that
 * multiply to the displayed score — a reviewer can check the arithmetic."
 * Recomputes `computeScore` directly from the same `factors` the row was
 * ranked with (rank.ts's own function, not a second, hand-summarized
 * version of it) so this can never drift from what actually produced the
 * order the queue is in. Radix HoverCard opens on hover *and* on the
 * trigger receiving focus, so this is reachable by keyboard too (gate
 * item 6) without a second, separate keyboard-only affordance.
 */
export function ScoreExplainer({ factors, now = new Date() }: ScoreExplainerProps) {
  const breakdown: ScoreBreakdown = computeScore(factors, now);
  const meta = ITEM_TYPE_META[factors.itemType];

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-sm border border-ink-400 bg-ink-200 px-1.5 py-0.5 text-meta font-medium text-fg-100 tabular-nums",
            "transition-instant transition-colors hover:border-ink-500 hover:text-fg-000",
            focusRing,
          )}
          aria-label={`Score ${round(breakdown.score)}. Show how this score was calculated.`}
        >
          {round(breakdown.score)}
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-80">
        <div className="flex flex-col gap-2">
          <p className="text-label font-medium text-fg-000">How this score was calculated</p>
          <dl className="flex flex-col gap-1.5 text-meta">
            <ExplainerRow
              label="Blast radius"
              detail={`${factors.severity} severity (${RANK_WEIGHTS.severityBase[factors.severity]}) + ${round(factors.magnitude, 1)} ${meta.magnitudeLabel} × ${RANK_WEIGHTS.magnitudeWeight}`}
              value={round(breakdown.blastRadius)}
            />
            <ExplainerRow
              label="Time decay"
              detail={`half-life ${RANK_WEIGHTS.halfLifeHours}h, floor ${RANK_WEIGHTS.decayFloor}`}
              value={round(breakdown.timeDecay, 3)}
            />
            <ExplainerRow
              label="Entity value"
              detail={`1 + log2(1 + ${round(factors.entitySignal, 1)}) × ${RANK_WEIGHTS.entitySignalWeight}`}
              value={round(breakdown.entityValue)}
            />
          </dl>
          <div className="flex items-center justify-between border-t border-ink-400 pt-2 text-label">
            <span className="text-fg-100">
              {round(breakdown.blastRadius)} × {round(breakdown.timeDecay, 3)} × {round(breakdown.entityValue)}
            </span>
            <span className="font-medium text-fg-000 tabular-nums">= {round(breakdown.score)}</span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function ExplainerRow({ label, detail, value }: { label: string; detail: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <dt className="text-fg-000">{label}</dt>
        <dd className="text-fg-200">{detail}</dd>
      </div>
      <span className="shrink-0 font-medium text-fg-000 tabular-nums">{value}</span>
    </div>
  );
}
