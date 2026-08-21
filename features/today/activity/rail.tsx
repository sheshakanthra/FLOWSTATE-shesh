"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { formatTimestamp } from "@/features/agents/lib/format";
import { useMotion } from "@/lib/motion";
import { todayQueryKeys } from "../live/query-keys";
import type { LiveActivityEvent } from "../live/events";
import { groupActivityByEntity } from "./group";

export interface ActivityRailProps {
  workspaceSlug: string;
  initialEvents: LiveActivityEvent[];
}

const NEW_GROUP_HIGHLIGHT_MS = 500;

/**
 * Session spec item 7: right column, recent workspace events, grouped by
 * entity (group.ts) rather than by time. Seeded from the page's own
 * server-rendered `listRecentActivity` call; kept live by `/api/live`'s
 * `activity_upsert` events (cache-patch.ts prepends -- activity events are
 * immutable once created, so "new" is the only state transition a real
 * event here ever represents).
 */
export function ActivityRail({ workspaceSlug, initialEvents }: ActivityRailProps) {
  const { data } = useQuery<LiveActivityEvent[]>({
    queryKey: todayQueryKeys.activity(workspaceSlug),
    queryFn: () => Promise.resolve(initialEvents),
    initialData: initialEvents,
  });
  const events = data ?? [];
  const groups = React.useMemo(() => groupActivityByEntity(events), [events]);
  const { prefersReducedMotion, base } = useMotion();

  const seenIdsRef = React.useRef<Set<string>>(new Set(initialEvents.map((event) => event.id)));
  const [newGroupKeys, setNewGroupKeys] = React.useState<ReadonlySet<string>>(new Set());

  React.useEffect(() => {
    const fresh = events.filter((event) => !seenIdsRef.current.has(event.id));
    if (fresh.length === 0) return;
    for (const event of fresh) seenIdsRef.current.add(event.id);
    const freshKeys = new Set(
      groups.filter((group) => group.events.some((event) => fresh.some((f) => f.id === event.id))).map((group) => group.key),
    );
    setNewGroupKeys((current) => new Set([...current, ...freshKeys]));
    const timer = setTimeout(() => {
      setNewGroupKeys((current) => {
        const next = new Set(current);
        for (const key of freshKeys) next.delete(key);
        return next;
      });
    }, NEW_GROUP_HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [events.map((event) => event.id).join(",")]);

  if (groups.length === 0) {
    return <p className="text-meta text-fg-200">No activity yet.</p>;
  }

  return (
    <div role="list" aria-label="Recent activity, grouped by entity" className="flex flex-col gap-1">
      <AnimatePresence initial={false}>
        {groups.map((group) => {
          const latest = group.events[0]!;
          const isNew = newGroupKeys.has(group.key);
          return (
            <motion.div
              key={group.key}
              role="listitem"
              layout={!prefersReducedMotion}
              initial={prefersReducedMotion || !isNew ? false : { opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={base}
              className="relative flex items-start gap-2.5 rounded-md px-2 py-2"
            >
              {isNew && !prefersReducedMotion ? (
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-md bg-blue-bg"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                />
              ) : null}
              <div aria-hidden="true" className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm border border-ink-400 bg-ink-200 text-fg-200">
                <Activity className="size-3" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-label text-fg-000">{latest.summary}</p>
                <div className="flex items-center gap-1.5 text-meta text-fg-200">
                  <span>{formatTimestamp(new Date(latest.createdAt))}</span>
                  {group.events.length > 1 ? <span className="shrink-0">+{group.events.length - 1} more</span> : null}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
