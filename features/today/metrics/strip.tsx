"use client";

import { useQuery } from "@tanstack/react-query";
import type { MetricsRollup } from "@/lib/repos/metrics";
import { todayQueryKeys } from "../live/query-keys";
import { Metric } from "./metric";

export interface MetricsStripProps {
  workspaceSlug: string;
  initialMetrics: MetricsRollup;
}

function formatCount(value: number): string {
  return String(Math.round(value));
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

/**
 * Session spec item 6: four numbers, seeded from the page's own server
 * render (same `initialData` pattern as zone.tsx/rail.tsx) so first paint
 * needs no client fetch, then kept fresh exclusively by `/api/live`'s
 * `metrics_update` events (cache-patch.ts) -- gate item 5's "never again
 * on live updates" is what `metric.tsx`'s `useCountUp` guarantees for each
 * of the four cards individually.
 */
export function MetricsStrip({ workspaceSlug, initialMetrics }: MetricsStripProps) {
  const { data } = useQuery<MetricsRollup>({
    queryKey: todayQueryKeys.metrics(workspaceSlug),
    queryFn: () => Promise.resolve(initialMetrics),
    initialData: initialMetrics,
  });
  const metrics = data ?? initialMetrics;
  const successRate = metrics.successRate;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric label="Runs today" value={metrics.runsToday} formatValue={formatCount} sparklineValues={metrics.sparklines.runsPerDay} />
      <Metric
        label="Success rate"
        value={successRate ?? 0}
        formatValue={(value) => (successRate === null ? "—" : `${Math.round(value * 100)}%`)}
        sparklineValues={metrics.sparklines.successRatePerDay}
      />
      <Metric label="Spend this week" value={metrics.spendThisWeekUsd} formatValue={formatUsd} sparklineValues={metrics.sparklines.spendPerDay} />
      <Metric label="Active agents" value={metrics.activeAgents} formatValue={formatCount} sparklineValues={metrics.sparklines.activeAgentsPerDay} />
    </div>
  );
}
