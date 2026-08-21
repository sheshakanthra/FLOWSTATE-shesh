"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shimmer } from "@/components/motion/shimmer";
import { EmberEdge } from "@/components/motion/ember-edge";
import { toast } from "@/components/ui/toast";
import type { LiveRunRecord } from "../live/events";
import { cancelRun } from "./cancel";

const STATUS_BADGE: Record<LiveRunRecord["status"], { label: string; variant: BadgeVariant }> = {
  running: { label: "Running", variant: "blue" },
  succeeded: { label: "Succeeded", variant: "emerald" },
  failed: { label: "Failed", variant: "red" },
  cancelled: { label: "Cancelled", variant: "neutral" },
};

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

/** Ticks once a second only while `active` -- a finished card's elapsed
 *  time is a fixed fact (its own `finishedAt`), not something that should
 *  keep re-rendering forever after the run is over. */
function useNow(active: boolean): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [active]);
  return now;
}

export interface RunCardProps {
  run: LiveRunRecord;
  workspaceSlug: string;
}

/**
 * Session spec item 1's card: agent name, trigger, elapsed time, current
 * node, live cost accumulation, cancel action. Item 2: wrapped in `Shimmer`
 * with a top `EmberEdge` while running -- this is the primary AI-as-light
 * surface the whole Today page's "visibly alive" objective rests on, so
 * neither is conditional on anything but `status === "running"`; a
 * finished card (still shown briefly, scope item 1) gets a plain static
 * card instead, since shimmering something that already finished would
 * read as a stuck/broken loading state, not truthful feedback.
 */
export function RunCard({ run, workspaceSlug }: RunCardProps) {
  const isRunning = run.status === "running";
  const now = useNow(isRunning);
  const endTime = run.finishedAt ? new Date(run.finishedAt).getTime() : now;
  const elapsedMs = endTime - new Date(run.startedAt).getTime();
  const [cancelling, setCancelling] = React.useState(false);
  const status = STATUS_BADGE[run.status];

  // Gate item 2 ("no full-list re-render, verified with the React
  // Profiler"): a plain ref-backed render counter, harmless in production
  // (never logs, never reads back except by a test) -- same instrumentation
  // B1's `GenericNode` used to prove its own per-node isolation.
  const renderCountRef = React.useRef(0);
  renderCountRef.current += 1;

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelRun(workspaceSlug, run.agentId, run.id);
    } catch {
      toast({ title: "Couldn't cancel that run", description: "Check your connection and try again.", variant: "danger" });
      setCancelling(false);
    }
    // Left spinning on success rather than reset here -- the card's own
    // status flips to "cancelled" (and Cancel disappears) the moment the
    // next /api/live tick reflects the run actually stopping, which gate
    // item 4 says should be within 500ms.
  }

  const body = (
    <div
      data-run-card={run.id}
      data-render-count={renderCountRef.current}
      className="relative flex flex-col gap-2 rounded-md border border-ink-400 bg-ink-100 p-card-padding shadow-card"
    >
      {isRunning ? <EmberEdge progress={null} /> : null}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-label font-medium text-fg-000">{run.agentName}</p>
          <p className="truncate text-meta text-fg-200">{run.trigger}</p>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      <div className="flex items-center justify-between gap-2 text-meta text-fg-100">
        <span className="min-w-0 truncate">{isRunning ? (run.currentNodeName ?? "Starting…") : (run.errorMessage ?? "Done")}</span>
        <span className="shrink-0 tabular-nums text-fg-200">{formatElapsed(elapsedMs)}</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-meta tabular-nums text-fg-200">${(run.liveCostCents / 100).toFixed(4)}</span>
        {isRunning ? (
          <Button size="sm" variant="secondary" onClick={() => void handleCancel()} loading={cancelling} aria-label={`Cancel ${run.agentName}`}>
            <X className="size-3.5" aria-hidden="true" />
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );

  return isRunning ? <Shimmer className="rounded-md">{body}</Shimmer> : body;
}
