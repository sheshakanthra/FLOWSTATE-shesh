"use client";

import * as React from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { nextEventTime, previousEventTime } from "./playhead";
import { useReplayStore, type PlaybackSpeed } from "./replay-store";
import { TimelineSegments } from "./timeline-segments";
import { CostMeter } from "./cost-meter";

const SPEEDS: PlaybackSpeed[] = [0.5, 1, 2, 4];

function formatMs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export interface ScrubberProps {
  onSelectNode: (nodeId: string) => void;
}

/**
 * The interactive timeline control (drag/keyboard/play/pause/speed) built
 * on top of TimelineSegments' read-only visualization. Playback and drag
 * both funnel through the same `useReplayStore.getState().setPlayhead()`
 * call -- there's exactly one way the playhead moves, so "frame accuracy"
 * (gate item 1) holds regardless of which input produced the new position.
 */
export function Scrubber({ onSelectNode }: ScrubberProps) {
  const steps = useReplayStore((state) => state.steps);
  const runDurationMs = useReplayStore((state) => state.runDurationMs);
  const playheadMs = useReplayStore((state) => state.playheadMs);
  const isPlaying = useReplayStore((state) => state.isPlaying);
  const speed = useReplayStore((state) => state.speed);
  const selectedNodeId = useReplayStore((state) => state.selectedNodeId);

  const trackRef = React.useRef<HTMLDivElement>(null);

  /**
   * rAF-driven playback loop, writing through the vanilla store API rather
   * than a hook subscription -- this effect only depends on `isPlaying`
   * (starting/stopping the loop), not `playheadMs` itself, so it doesn't
   * tear down and restart every frame. Only Scrubber (which subscribes to
   * `playheadMs` above, to render the moving line) re-renders each tick;
   * ReplayNode/ReplayEdge instances re-render only when their own derived
   * value in replay-store's cached `nodeStates`/`activeEdgeIds` actually
   * changes -- the same granular-selector property gate item 2 depends on.
   */
  React.useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    let last = performance.now();
    function tick(now: number) {
      const delta = now - last;
      last = now;
      const state = useReplayStore.getState();
      state.setPlayhead(state.playheadMs + delta * state.speed);
      if (useReplayStore.getState().isPlaying) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  const msFromClientX = React.useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || runDurationMs <= 0) return 0;
      const rect = track.getBoundingClientRect();
      const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
      return ratio * runDurationMs;
    },
    [runDurationMs],
  );

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    useReplayStore.getState().pause();
    useReplayStore.getState().setPlayhead(msFromClientX(event.clientX));
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (event.buttons !== 1) return;
    useReplayStore.getState().setPlayhead(msFromClientX(event.clientX));
  }

  /** Gate item 7: arrow keys step event to event, space toggles play/pause. */
  function handleTrackKeyDown(event: React.KeyboardEvent) {
    const state = useReplayStore.getState();
    if (event.key === "ArrowRight") {
      event.preventDefault();
      state.pause();
      state.setPlayhead(nextEventTime(state.steps, state.playheadMs, state.runDurationMs));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      state.pause();
      state.setPlayhead(previousEventTime(state.steps, state.playheadMs, state.runDurationMs));
    } else if (event.key === " ") {
      event.preventDefault();
      if (state.isPlaying) state.pause();
      else state.play();
    } else if (event.key === "Home") {
      event.preventDefault();
      state.pause();
      state.setPlayhead(0);
    } else if (event.key === "End") {
      event.preventDefault();
      state.pause();
      state.setPlayhead(state.runDurationMs);
    }
  }

  const playheadPercent = runDurationMs > 0 ? (playheadMs / runDurationMs) * 100 : 0;

  return (
    <div className="flex h-full flex-col bg-ink-100">
      <div className="flex shrink-0 items-center gap-3 border-b border-ink-400/60 px-3 py-2">
        <Button
          variant="secondary"
          size="icon"
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={() => {
            const state = useReplayStore.getState();
            if (state.isPlaying) state.pause();
            else state.play();
          }}
        >
          {isPlaying ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
        </Button>

        <div className="flex items-center gap-1" role="group" aria-label="Playback speed">
          {SPEEDS.map((option) => (
            <Button
              key={option}
              variant={speed === option ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={speed === option}
              onClick={() => useReplayStore.getState().setSpeed(option)}
            >
              {option}×
            </Button>
          ))}
        </div>

        <span className="text-meta text-fg-100 tabular-nums">
          {formatMs(playheadMs)} / {formatMs(runDurationMs)}
        </span>

        <CostMeter className="ml-auto" />
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Playhead"
          aria-valuemin={0}
          aria-valuemax={runDurationMs}
          aria-valuenow={Math.round(playheadMs)}
          aria-valuetext={formatMs(playheadMs)}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onKeyDown={handleTrackKeyDown}
          className={cn(
            "relative w-full cursor-pointer touch-none rounded-sm outline-none",
            "focus-visible:ring-2 focus-visible:ring-blue-fg focus-visible:ring-offset-2 focus-visible:ring-offset-ink-100",
          )}
        >
          <TimelineSegments
            steps={steps}
            durationMs={runDurationMs}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-px bg-blue-fg"
            style={{ left: `${playheadPercent}%` }}
          >
            <div className="absolute -top-1 -left-1.5 size-3 rounded-full bg-blue-fg" />
          </div>
        </div>
      </div>
    </div>
  );
}
