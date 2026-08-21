"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { useMotion } from "@/lib/motion";
import { todayQueryKeys } from "../live/query-keys";
import type { LiveRunRecord } from "../live/events";
import { RunCard } from "./run-card";

export interface InFlightZoneProps {
  workspaceSlug: string;
  initialRuns: LiveRunRecord[];
}

/** `React.memo` is what actually delivers gate item 2's "no full-list
 *  re-render": `cache-patch.ts`'s `upsertById` reuses every unrelated
 *  array entry's exact object reference, so a memoized card bails out of
 *  re-rendering (and repainting) unless it's the one row that changed --
 *  the parent re-mapping the array on every query update is expected and
 *  cheap; what must not happen is every *card* redoing its own render. */
const MemoRunCard = React.memo(RunCard);

const NEW_ITEM_HIGHLIGHT_MS = 500;

/**
 * Session spec item 1: live cards for currently running agents and
 * recently completed runs. `useQuery` is seeded with `initialData` (the
 * page's own server-rendered `listInFlightRuns` call) so the very first
 * paint needs no client fetch; every update after that arrives exclusively
 * through `/api/live`'s `setQueryData` patches (`cache-patch.ts`) -- this
 * query has no `queryFn` that could ever really run, matching `staleTime:
 * Infinity` (query-provider.tsx) and the session's own "never invalidate"
 * rule.
 */
export function InFlightZone({ workspaceSlug, initialRuns }: InFlightZoneProps) {
  const { data } = useQuery<LiveRunRecord[]>({
    queryKey: todayQueryKeys.runs(workspaceSlug),
    queryFn: () => Promise.resolve(initialRuns),
    initialData: initialRuns,
  });
  const { prefersReducedMotion, base } = useMotion();
  const runs = data ?? [];

  // Scope item 5's wash applies only to a card that arrived *after* this
  // component was already showing something -- not to whatever the server
  // already rendered on first paint (those aren't "new," they're just
  // "already running"). Tracked separately from AnimatePresence's own
  // `initial={false}` (which only gates the outer slide/scale transition)
  // since the wash is a plain child, not an AnimatePresence-managed exit.
  const seenIdsRef = React.useRef<Set<string>>(new Set(initialRuns.map((run) => run.id)));
  const [newIds, setNewIds] = React.useState<ReadonlySet<string>>(new Set());

  const runIdsKey = runs.map((run) => run.id).join(",");
  React.useEffect(() => {
    const freshIds = runIdsKey === "" ? [] : runIdsKey.split(",").filter((id) => !seenIdsRef.current.has(id));
    if (freshIds.length === 0) return;
    for (const id of freshIds) seenIdsRef.current.add(id);
    setNewIds((current) => new Set([...current, ...freshIds]));
    const timer = setTimeout(() => {
      setNewIds((current) => {
        const next = new Set(current);
        for (const id of freshIds) next.delete(id);
        return next;
      });
    }, NEW_ITEM_HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [runIdsKey]);

  if (runs.length === 0) return null;

  return (
    <div role="list" aria-label="Running and recently completed agents" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <AnimatePresence initial={false}>
        {runs.map((run) => {
          const isNew = newIds.has(run.id);
          return (
            <motion.div
              key={run.id}
              role="listitem"
              layout={!prefersReducedMotion}
              initial={prefersReducedMotion || !isNew ? false : { opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              transition={base}
              className="relative"
            >
              {isNew && !prefersReducedMotion ? (
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-10 rounded-md bg-blue-bg"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                />
              ) : null}
              <MemoRunCard run={run} workspaceSlug={workspaceSlug} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
