"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { WorkspaceMemberSummary } from "@/lib/repos/workspaces";
import { rankPriorityItems } from "../lib/rank";
import { resolveHref } from "./actions";
import { getSnoozeUntil } from "./snooze";
import { useQueueActions, type PriorityItemClient } from "./store";
import { PriorityRow } from "./row";

export interface PriorityQueueProps {
  workspaceSlug: string;
  members: WorkspaceMemberSummary[];
  /** The real, server-rendered list (`app/(app)/w/[workspace]/today/page.tsx`'s
   *  own `listPriorityItems` call) -- what the very first paint shows, which
   *  is what gate item 3's 800ms budget is actually about. This component
   *  never issues its own initial fetch. */
  initialItems: PriorityItemClient[];
}

const ESTIMATED_ROW_HEIGHT = 132;

/**
 * Session spec items 1/6/7: the ranked, keyboard-operable queue itself.
 * `role="listbox"` + `aria-activedescendant` + a single `activeIndex`
 * (gate item 6) is the same shape `components/patterns/data-table/
 * data-table.tsx` already established for its own `role="grid"` -- moving
 * real DOM focus onto virtualized rows that mount/unmount as you scroll is
 * fragile, so focus stays on the container and `aria-activedescendant`
 * tells assistive tech which option is current.
 */
export function PriorityQueue({ workspaceSlug, members, initialItems }: PriorityQueueProps) {
  const router = useRouter();
  const [items, setItems] = React.useState(initialItems);
  const actions = useQueueActions(workspaceSlug, items, setItems);

  // Ticks once a minute so a snoozed item's dimmed state (and the "Snoozed
  // — returns …" copy) clears itself once `snoozedUntil` actually passes
  // (gate item 7), without needing D2's live-update infrastructure -- this
  // session's scope is explicitly not that.
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  // Spec item 5: resolved rows "collapse out" -- filtered here, not just
  // styled differently, so an optimistic resolve (gate item 4) removes the
  // row immediately instead of waiting for a server round trip, and ⌘Z
  // (gate item 5) brings it back the same way undoing any other field
  // change does, just by flipping `resolved` back to false in local state.
  const ranked = React.useMemo(
    () =>
      rankPriorityItems(
        items.filter((item) => !item.resolved).map((item) => ({ ...item, createdAt: new Date(item.createdAt) })),
        now,
      ),
    [items, now],
  );

  const [activeIndex, setActiveIndex] = React.useState(0);
  React.useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, ranked.length - 1)));
  }, [ranked.length]);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: ranked.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 8,
  });

  const listId = React.useId();

  function moveActive(delta: number) {
    setActiveIndex((current) => {
      const next = Math.min(Math.max(current + delta, 0), ranked.length - 1);
      virtualizer.scrollToIndex(next, { align: "auto" });
      return next;
    });
  }

  function jumpTo(index: number) {
    if (index < 0 || index >= ranked.length) return;
    setActiveIndex(index);
    virtualizer.scrollToIndex(index, { align: "auto" });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const active = ranked[activeIndex];
    switch (event.key) {
      case "j":
      case "ArrowDown":
        event.preventDefault();
        moveActive(1);
        return;
      case "k":
      case "ArrowUp":
        event.preventDefault();
        moveActive(-1);
        return;
      case "Enter": {
        event.preventDefault();
        if (!active) return;
        const href = resolveHref(active, workspaceSlug);
        if (href) router.push(href);
        return;
      }
      case "e":
        event.preventDefault();
        if (active) void actions.resolve(active.id);
        return;
      case "s":
        // The keyboard shortcut applies the common default directly
        // (see snooze.tsx's own note) rather than opening the picker --
        // the pointer path (the row's Snooze button) still offers the
        // full 1h/tomorrow/next-week menu.
        event.preventDefault();
        if (active) void actions.snooze(active.id, getSnoozeUntil("tomorrow"), "Tomorrow");
        return;
      default:
        if (/^[1-9]$/.test(event.key)) {
          event.preventDefault();
          jumpTo(Number(event.key) - 1);
        }
    }
  }

  if (ranked.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Nothing needs you right now"
        description="Every agent is running clean and nothing's waiting on you. Build a new agent, or check in on what's already running."
        action={{ label: "View agents", onClick: () => router.push(`/w/${workspaceSlug}/agents`) }}
      />
    );
  }

  const activeItem = ranked[activeIndex];

  return (
    <div
      ref={scrollRef}
      role="listbox"
      aria-label="Priority queue"
      id={listId}
      tabIndex={0}
      aria-activedescendant={activeItem ? `${listId}-item-${activeItem.id}` : undefined}
      onKeyDown={handleKeyDown}
      className="max-h-[calc(100vh-16rem)] overflow-y-auto rounded-md border border-ink-400 outline-none focus-visible:ring-2 focus-visible:ring-blue-fg"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = ranked[virtualRow.index];
          if (!item) return null;
          return (
            <div
              key={item.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualRow.start}px)` }}
            >
              <PriorityRow
                listId={listId}
                item={item}
                workspaceSlug={workspaceSlug}
                members={members}
                actions={actions}
                active={virtualRow.index === activeIndex}
                now={now}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
