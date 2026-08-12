"use client";

import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { deriveCostCentsAtTime } from "./playhead";
import { useReplayStore } from "./replay-store";

function formatCents(cents: number): string {
  if (cents < 1) return `${cents.toFixed(4)}¢`;
  return `${cents.toFixed(2)}¢`;
}

export interface CostMeterProps {
  className?: string;
}

/** Gate item 5: a running total that accumulates as the playhead advances
 *  and lands on the run's exact recorded total once playback reaches the
 *  end -- see deriveCostCentsAtTime's own doc comment for why the last
 *  instant snaps to the authoritative figure instead of trusting a
 *  re-summed float to match it. Subscribes to `steps`/`playheadMs`
 *  directly rather than reading replay-store's cached `nodeStates` map, so
 *  it re-renders on every playhead tick the way the moving scrubber line
 *  does -- unlike a node, there's only ever one cost meter on screen, so
 *  there's no fan-out re-render cost to avoid here. */
export function CostMeter({ className }: CostMeterProps) {
  const steps = useReplayStore((state) => state.steps);
  const playheadMs = useReplayStore((state) => state.playheadMs);
  const runDurationMs = useReplayStore((state) => state.runDurationMs);
  const finalTotalCostCents = useReplayStore((state) => state.finalTotalCostCents);

  const costCents = deriveCostCentsAtTime(steps, playheadMs, runDurationMs, finalTotalCostCents);

  return (
    <span className={cn("flex items-center gap-1.5 text-meta text-fg-100 tabular-nums", className)}>
      <Coins className="size-3.5" aria-hidden="true" />
      {formatCents(costCents)}
      <span className="text-fg-200">of {formatCents(finalTotalCostCents)}</span>
    </span>
  );
}
