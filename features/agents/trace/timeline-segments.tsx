"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { NormalizedStep } from "./playhead";

export interface SegmentLayoutItem {
  step: NormalizedStep;
  row: number;
}

/**
 * Greedy interval stacking (the same algorithm a calendar view uses to lay
 * out overlapping meetings): sorted by start time, a step claims the lowest
 * row whose most recently placed segment has already ended; if none is
 * free, it opens a new row. Two genuinely concurrent steps (real overlapping
 * start/end windows -- see B4's decision that the engine executes
 * sequentially today, so no *live* run produces this yet, only fixture data
 * and any future concurrent engine) end up on different rows, which is
 * exactly gate item 3's "overlapping segments stack, so parallelism is
 * visible." Non-overlapping steps share a row rather than each claiming
 * their own, keeping the common (sequential) case compact.
 */
export function computeSegmentLayout(steps: NormalizedStep[]): SegmentLayoutItem[] {
  const sorted = [...steps].sort((a, b) => a.startMs - b.startMs || a.stepIndex - b.stepIndex);
  const rowEndTimes: number[] = [];
  const result: SegmentLayoutItem[] = [];

  for (const step of sorted) {
    let row = rowEndTimes.findIndex((endTime) => endTime <= step.startMs);
    if (row === -1) {
      row = rowEndTimes.length;
      rowEndTimes.push(step.endMs);
    } else {
      rowEndTimes[row] = step.endMs;
    }
    result.push({ step, row });
  }

  return result;
}

const STATUS_CLASSES: Record<NormalizedStep["status"], string> = {
  succeeded: "border-emerald-line bg-emerald-bg",
  failed: "border-red-line bg-red-bg",
  skipped: "border-dashed border-ink-500 bg-ink-200",
};

export const ROW_HEIGHT = 22;
export const ROW_GAP = 4;
/** A zero-duration (instant/skipped) step still needs to read as a mark on
 *  the timeline, not disappear as a 0px-wide div. */
const MIN_SEGMENT_WIDTH_PERCENT = 0.6;

export interface TimelineSegmentsProps {
  steps: NormalizedStep[];
  durationMs: number;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

/** The read-only visualization the scrubber (scrubber.tsx) is built on top
 *  of -- positions and sizes each node's execution segment by its real
 *  start time and duration, stacking rows for genuine overlap. Interaction
 *  (playhead drag, keyboard, play/pause) lives in the parent; segments here
 *  are click-to-select-node only. */
export function TimelineSegments({ steps, durationMs, selectedNodeId, onSelectNode }: TimelineSegmentsProps) {
  const layout = React.useMemo(() => computeSegmentLayout(steps), [steps]);
  const rowCount = Math.max(1, ...layout.map((item) => item.row + 1));
  const safeDuration = durationMs > 0 ? durationMs : 1;

  return (
    <div
      className="relative w-full"
      style={{ height: rowCount * ROW_HEIGHT + (rowCount - 1) * ROW_GAP }}
    >
      {layout.map(({ step, row }) => {
        const leftPercent = (step.startMs / safeDuration) * 100;
        const widthPercent = Math.max(((step.endMs - step.startMs) / safeDuration) * 100, MIN_SEGMENT_WIDTH_PERCENT);
        return (
          <button
            key={step.nodeId}
            type="button"
            title={`${step.name} — ${step.status}`}
            onClick={() => onSelectNode(step.nodeId)}
            className={cn(
              "absolute rounded-sm border text-left transition-instant",
              STATUS_CLASSES[step.status],
              selectedNodeId === step.nodeId && "ring-2 ring-blue-fg ring-offset-1 ring-offset-ink-100",
            )}
            style={{
              left: `${leftPercent}%`,
              width: `${widthPercent}%`,
              top: row * (ROW_HEIGHT + ROW_GAP),
              height: ROW_HEIGHT,
            }}
          >
            <span className="sr-only">{step.name}</span>
          </button>
        );
      })}
    </div>
  );
}
