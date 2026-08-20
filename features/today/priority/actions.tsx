"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, User, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import type { WorkspaceMemberSummary } from "@/lib/repos/workspaces";
import { ITEM_TYPE_META } from "../lib/item-types";
import { getSnoozeUntil, SnoozeMenu, SNOOZE_PRESETS, type SnoozePreset } from "./snooze";
import type { QueueActions, RankedPriorityItem } from "./store";

/** Where "Open" (and Enter, from the keyboard) sends the user -- the one
 *  real entity type this slice's items point at is an agent. An item with
 *  no resolvable source (a workspace-wide "system" row) has nowhere to
 *  open; its Open action is omitted rather than linking nowhere. */
function resolveHref(item: Pick<RankedPriorityItem, "sourceType" | "sourceId">, workspaceSlug: string): string | null {
  if (item.sourceType === "agent" && item.sourceId) {
    return `/w/${workspaceSlug}/agents/${item.sourceId}/build`;
  }
  return null;
}

export interface RowActionsProps {
  item: RankedPriorityItem;
  workspaceSlug: string;
  members: WorkspaceMemberSummary[];
  actions: QueueActions;
}

/**
 * Session spec item 4: approve, retry, snooze, delegate, open -- per row.
 * Which of "Retry"/"Approve"/"Review" shows is decided by `itemType`
 * (`ITEM_TYPE_META`), since only a failed run has anything real to retry
 * and only a human-in-loop item has anything to approve; every other type
 * gets "Review" (== Open). Snooze/delegate/resolve/open are universal.
 */
export function RowActions({ item, workspaceSlug, members, actions }: RowActionsProps) {
  const router = useRouter();
  const { resolve, snooze, delegate } = actions;
  const [retrying, setRetrying] = React.useState(false);

  const href = resolveHref(item, workspaceSlug);
  const meta = ITEM_TYPE_META[item.itemType];

  async function handlePrimaryAction() {
    if (meta.primaryAction.kind === "retry") {
      if (!item.sourceId) return;
      setRetrying(true);
      try {
        const response = await fetch(`/api/agents/${item.sourceId}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceSlug }),
        });
        if (!response.ok) throw new Error("The run didn't start.");
        // A retry's own outcome shows up back in the queue on its own
        // (a fresh failure re-materializes the item; a success resolves it
        // -- see lib/repos/priorities.ts#syncAgentPriorityItems), not as a
        // live progress view here: that's D2's in-flight zone, explicitly
        // out of this session's scope. Marking this item resolved is what's
        // undoable (gate item 4/5); the run itself, once fired, isn't --
        // same reasoning C3's tool-call retry gave for not undoing a real
        // side effect that already happened.
        void resolve(item.id);
      } catch {
        toast({ title: "Couldn't start the retry", description: "Check your connection and try again.", variant: "danger" });
      } finally {
        setRetrying(false);
      }
      return;
    }
    // "approve" and "review" both just resolve -- there's no real
    // human-in-loop approval target to act on yet (see
    // features/agents/engine/node-executors/human-in-loop.ts's own doc
    // comment), and "review" is this row's own way of saying "I looked at
    // this," not a distinct system action.
    void resolve(item.id);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
      <Button size="sm" onClick={() => void handlePrimaryAction()} loading={retrying}>
        {meta.primaryAction.kind === "retry" ? <RotateCcw className="size-3.5" aria-hidden="true" /> : <Check className="size-3.5" aria-hidden="true" />}
        {meta.primaryAction.label}
      </Button>

      <SnoozeMenu onSnooze={(preset: SnoozePreset) => void snooze(item.id, getSnoozeUntil(preset), SNOOZE_PRESETS.find((p) => p.id === preset)!.label)} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="secondary">
            <User className="size-3.5" aria-hidden="true" />
            {item.assigneeName ?? "Delegate"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {members.map((member) => (
            <DropdownMenuItem key={member.id} onSelect={() => void delegate(item.id, member.id, member.name)}>
              {member.name}
            </DropdownMenuItem>
          ))}
          {item.assigneeId ? (
            <DropdownMenuItem onSelect={() => void delegate(item.id, null, null)}>
              <UserX className="size-3.5" aria-hidden="true" />
              Remove delegate
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {href ? (
        <Button size="sm" variant="ghost" onClick={() => router.push(href)}>
          Open
        </Button>
      ) : null}

      <Button size="sm" variant="ghost" aria-label={`Resolve: ${item.title}`} onClick={() => void resolve(item.id)}>
        <Check className="size-3.5" aria-hidden="true" />
        Resolve
      </Button>
    </div>
  );
}

export { resolveHref };
