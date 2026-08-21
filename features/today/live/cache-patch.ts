import type { QueryClient } from "@tanstack/react-query";
import type { MetricsRollup } from "@/lib/repos/metrics";
import type { PriorityItemClient } from "@/features/today/priority/store";
import type { LiveActivityEvent, LiveEvent, LiveRunRecord } from "./events";
import { todayQueryKeys } from "./query-keys";

/**
 * The whole point of this session (Notes: "Write the patch functions
 * carefully; an invalidate call anywhere in the live path defeats the
 * session"). Every function here is `setQueryData` with an updater that
 * edits exactly the one row an event names -- there is no `invalidateQueries`
 * call anywhere in this file, and there must never be one added: an
 * invalidate would trigger a real network refetch and a full-list
 * re-render, exactly the visible flash gate item 2 checks for.
 */

function upsertById<T extends { id: string }>(list: T[] | undefined, item: T): T[] {
  const current = list ?? [];
  const index = current.findIndex((existing) => existing.id === item.id);
  if (index === -1) return [...current, item];
  if (current[index] === item) return current;
  const next = current.slice();
  next[index] = item;
  return next;
}

function removeById<T extends { id: string }>(list: T[] | undefined, id: string): T[] {
  const current = list ?? [];
  if (!current.some((item) => item.id === id)) return current;
  return current.filter((item) => item.id !== id);
}

function prependIfNew<T extends { id: string }>(list: T[] | undefined, item: T): T[] {
  const current = list ?? [];
  if (current.some((existing) => existing.id === item.id)) return current;
  return [item, ...current];
}

export function applyLiveEvent(queryClient: QueryClient, workspaceSlug: string, event: LiveEvent): void {
  switch (event.type) {
    case "run_upsert":
      queryClient.setQueryData<LiveRunRecord[]>(todayQueryKeys.runs(workspaceSlug), (current) => upsertById(current, event.run));
      return;
    case "run_remove":
      queryClient.setQueryData<LiveRunRecord[]>(todayQueryKeys.runs(workspaceSlug), (current) => removeById(current, event.runId));
      return;
    case "priority_upsert":
      queryClient.setQueryData<PriorityItemClient[]>(todayQueryKeys.priorities(workspaceSlug), (current) => upsertById(current, event.item));
      return;
    case "priority_remove":
      queryClient.setQueryData<PriorityItemClient[]>(todayQueryKeys.priorities(workspaceSlug), (current) => removeById(current, event.itemId));
      return;
    case "activity_upsert":
      queryClient.setQueryData<LiveActivityEvent[]>(todayQueryKeys.activity(workspaceSlug), (current) => prependIfNew(current, event.event));
      return;
    case "metrics_update":
      // Metrics has no id-keyed list to patch a single row of -- the whole
      // rollup is the unit, and `getMetricsRollup` already only emits an
      // event when its own serialized output actually changed (see
      // app/api/live/route.ts), so this is still a targeted write, not a
      // periodic stomp.
      queryClient.setQueryData<MetricsRollup>(todayQueryKeys.metrics(workspaceSlug), event.metrics);
      return;
  }
}
