"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WifiOff } from "lucide-react";
import type { WorkspaceMemberSummary } from "@/lib/repos/workspaces";
import type { MetricsRollup } from "@/lib/repos/metrics";
import { applyLiveEvent } from "./live/cache-patch";
import type { LiveActivityEvent, LiveRunRecord } from "./live/events";
import { useLiveConnection } from "./live/reconnect";
import { InFlightZone } from "./inflight/zone";
import { MetricsStrip } from "./metrics/strip";
import { ActivityRail } from "./activity/rail";
import { PriorityQueue, type PriorityQueueHandle } from "./priority/queue";
import type { PriorityItemClient } from "./priority/store";

export interface TodayShellProps {
  workspaceSlug: string;
  members: WorkspaceMemberSummary[];
  initialPriorityItems: PriorityItemClient[];
  initialRuns: LiveRunRecord[];
  initialMetrics: MetricsRollup;
  initialActivity: LiveActivityEvent[];
}

/**
 * One `/api/live` connection for the whole Today page (session Notes
 * imply, and gate item 1's "within 2 seconds" is measured end to end, not
 * per-widget) -- opened here, once, and fanned out to whichever cache each
 * event actually belongs to: `cache-patch.ts` for runs/activity/metrics
 * (all TanStack Query-backed), and directly into the priority queue's own
 * imperative handle for priority events, since that component owns its
 * data as local state, not a query (see queue.tsx's own doc comment for
 * why). This is the one file that needs to know about every Today data
 * source at once; every child component below stays scoped to just its
 * own slice.
 */
export function TodayShell({
  workspaceSlug,
  members,
  initialPriorityItems,
  initialRuns,
  initialMetrics,
  initialActivity,
}: TodayShellProps) {
  const queryClient = useQueryClient();
  const queueRef = React.useRef<PriorityQueueHandle>(null);

  const status = useLiveConnection(
    workspaceSlug,
    React.useCallback(
      (event) => {
        if (event.type === "priority_upsert") {
          queueRef.current?.applyLiveEvent({ type: "upsert", item: event.item });
          return;
        }
        if (event.type === "priority_remove") {
          queueRef.current?.applyLiveEvent({ type: "remove", itemId: event.itemId });
          return;
        }
        applyLiveEvent(queryClient, workspaceSlug, event);
      },
      [queryClient, workspaceSlug],
    ),
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Gate item 3: "a subtle offline indicator while disconnected" --
          absent entirely once connected, so it never competes for
          attention with the actual content on the common path. */}
      {status === "offline" ? (
        <div role="status" className="flex items-center gap-2 rounded-md border border-amber-line bg-amber-bg px-3 py-2 text-meta text-amber-fg">
          <WifiOff className="size-3.5 shrink-0" aria-hidden="true" />
          Live updates paused — reconnecting…
        </div>
      ) : null}

      <MetricsStrip workspaceSlug={workspaceSlug} initialMetrics={initialMetrics} />

      <InFlightZone workspaceSlug={workspaceSlug} initialRuns={initialRuns} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <PriorityQueue ref={queueRef} workspaceSlug={workspaceSlug} members={members} initialItems={initialPriorityItems} />
        <aside aria-label="Activity">
          <ActivityRail workspaceSlug={workspaceSlug} initialEvents={initialActivity} />
        </aside>
      </div>
    </div>
  );
}
