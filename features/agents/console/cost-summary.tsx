"use client";

import { Coins, Timer } from "lucide-react";
import type { RunSummary } from "./types";

export interface CostSummaryProps {
  summary: RunSummary | null;
}

function formatCents(cents: number): string {
  if (cents < 1) return `${cents.toFixed(4)}¢`;
  return `${cents.toFixed(2)}¢`;
}

/** Session spec item 4's "cost and latency summary" -- and the number gate
 *  item 7 checks against Groq's own reported usage. Cost is summed from
 *  every step's real, provider-reported token usage (lib/llm/models.ts's
 *  `estimateCostCents`, applied per step in the LLM executor and totaled
 *  by the orchestrator), not estimated after the fact from a blended rate. */
export function CostSummary({ summary }: CostSummaryProps) {
  if (!summary || summary.status === "idle") return null;

  return (
    <div className="flex items-center gap-4 border-t border-ink-400/60 px-3 py-2 text-meta text-fg-100">
      <span className="flex items-center gap-1.5">
        <Coins className="size-3.5" aria-hidden="true" />
        {formatCents(summary.totalCostCents)}
      </span>
      <span className="flex items-center gap-1.5">
        <Timer className="size-3.5" aria-hidden="true" />
        {summary.totalDurationMs}ms
      </span>
    </div>
  );
}
