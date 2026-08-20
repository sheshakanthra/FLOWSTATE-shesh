"use client";

import * as React from "react";
import { toast } from "@/components/ui/toast";
import { pushUndoEntry, undo as undoLast } from "@/lib/undo/store";
import type { PriorityItemType } from "../lib/item-types";
import type { PrioritySeverity } from "../lib/rank";

export interface PriorityItemClient {
  id: string;
  title: string;
  description: string | null;
  severity: PrioritySeverity;
  itemType: PriorityItemType;
  sourceType: string;
  sourceId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  resolved: boolean;
  magnitude: number;
  entitySignal: number;
  /** ISO strings, not `Date` -- what the wire (and `queue.tsx`'s own list
   *  state) carries; `rank.ts`/`score-explainer.tsx` convert at the one
   *  point that needs a real `Date`. */
  snoozedUntil: string | null;
  createdAt: string;
}

/** The shape `queue.tsx` produces after `rankPriorityItems` (rank.ts needs
 *  a real `Date` to compute time decay) -- `row.tsx`/`actions.tsx` consume
 *  this, never the wire-shaped `PriorityItemClient` with its ISO string,
 *  since every consumer past the queue's own ranking step wants a `Date`
 *  it can hand straight to `ScoreExplainer`. */
export interface RankedPriorityItem extends Omit<PriorityItemClient, "createdAt"> {
  createdAt: Date;
}

type PriorityPatch = { resolved?: boolean; snoozedUntil?: string | null; assigneeId?: string | null };

function withPatch(item: PriorityItemClient, patch: PriorityPatch): PriorityItemClient {
  return {
    ...item,
    resolved: patch.resolved ?? item.resolved,
    snoozedUntil: patch.snoozedUntil !== undefined ? patch.snoozedUntil : item.snoozedUntil,
    assigneeId: patch.assigneeId !== undefined ? patch.assigneeId : item.assigneeId,
  };
}

export interface QueueActions {
  resolve: (itemId: string) => Promise<void>;
  snooze: (itemId: string, until: Date, label: string) => Promise<void>;
  delegate: (itemId: string, assigneeId: string | null, assigneeName: string | null) => Promise<void>;
}

/**
 * The queue's own optimistic-mutation-plus-undo logic, as a hook over
 * whatever list state its one caller (`queue.tsx`) already owns --
 * `PriorityQueue` is the only consumer, so this is a plain custom hook over
 * local `useState`, not a global store: the page-local SSR data
 * (`listPriorityItems`, read once by `app/(app)/w/[workspace]/today/page.tsx`)
 * is what the very first paint renders (gate item 3's 800ms budget), and
 * there's no second component anywhere else in the app that needs this same
 * list, unlike the copilot dock's genuinely cross-component thread state.
 *
 * CLAUDE.md's own hard rule ("every mutation is optimistic with a rollback,
 * and registers an inverse with `useUndoable`") applies to all three
 * mutating actions here, not just the two gate item 5 names explicitly
 * (resolve, snooze) -- delegate gets the same treatment for consistency.
 * `previousItem` is captured before the optimistic write so both the
 * automatic rollback-on-server-failure (gate item 4) and the explicit ⌘Z
 * reversal (gate item 5) reverse to the same real prior state.
 */
export function useQueueActions(
  workspaceSlug: string,
  items: PriorityItemClient[],
  setItems: React.Dispatch<React.SetStateAction<PriorityItemClient[]>>,
): QueueActions {
  const itemsRef = React.useRef(items);
  itemsRef.current = items;

  const applyAction = React.useCallback(
    async (itemId: string, patch: PriorityPatch, label: string): Promise<void> => {
      const previousItem = itemsRef.current.find((item) => item.id === itemId);
      if (!previousItem) return;
      const previousPatch: PriorityPatch = { resolved: previousItem.resolved, snoozedUntil: previousItem.snoozedUntil, assigneeId: previousItem.assigneeId };

      setItems((current) => current.map((item) => (item.id === itemId ? withPatch(item, patch) : item)));

      try {
        const response = await fetch("/api/priorities", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceSlug, itemId, ...patch }),
        });
        if (!response.ok) throw new Error("The request failed.");
        const { item } = (await response.json()) as { item: PriorityItemClient };
        setItems((current) => current.map((existing) => (existing.id === itemId ? item : existing)));

        pushUndoEntry({
          id: crypto.randomUUID(),
          label,
          undo: () => void applyAction(itemId, previousPatch, `Undid: ${label}`),
          redo: () => void applyAction(itemId, patch, label),
        });
        toast({ title: label, action: { label: "Undo", onClick: () => undoLast() } });
      } catch {
        // Gate item 4: reverses correctly on server failure -- back to the
        // exact pre-action item, not just a generic "something broke" state.
        setItems((current) => current.map((item) => (item.id === itemId ? previousItem : item)));
        toast({ title: "Couldn't save that change", description: "Check your connection and try again.", variant: "danger" });
      }
    },
    [workspaceSlug, setItems],
  );

  return React.useMemo(
    () => ({
      resolve: (itemId: string) => applyAction(itemId, { resolved: true }, "Resolved"),
      snooze: (itemId: string, until: Date, label: string) => applyAction(itemId, { snoozedUntil: until.toISOString() }, `Snoozed until ${label}`),
      delegate: (itemId: string, assigneeId: string | null, assigneeName: string | null) =>
        applyAction(itemId, { assigneeId }, assigneeName ? `Delegated to ${assigneeName}` : "Delegate removed"),
    }),
    [applyAction],
  );
}
