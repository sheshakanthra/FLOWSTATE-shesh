"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { WorkspaceMemberSummary } from "@/lib/repos/workspaces";
import { formatTimestamp } from "@/features/agents/lib/format";
import { cn } from "@/lib/utils";
import { ITEM_TYPE_META } from "../lib/item-types";
import type { PrioritySeverity } from "../lib/rank";
import { RowActions } from "./actions";
import { ScoreExplainer } from "./score-explainer";
import type { QueueActions, RankedPriorityItem } from "./store";

const SEVERITY_BADGE: Record<PrioritySeverity, BadgeVariant> = {
  critical: "red",
  high: "amber",
  medium: "blue",
  low: "neutral",
};

export interface PriorityRowProps {
  listId: string;
  item: RankedPriorityItem;
  workspaceSlug: string;
  members: WorkspaceMemberSummary[];
  actions: QueueActions;
  active: boolean;
  now: Date;
}

/**
 * Session spec item 5's four row states -- three of them render here
 * (resolved is handled by the queue simply no longer including the row,
 * "collapses out"). Urgent gets a red hairline on the *left edge*
 * specifically (not a full border) so it reads as a status flag, not a
 * validation error the way a full red outline would elsewhere in this
 * design system.
 */
export function PriorityRow({ listId, item, workspaceSlug, members, actions, active, now }: PriorityRowProps) {
  const meta = ITEM_TYPE_META[item.itemType];
  const Icon = meta.icon;
  const snoozedUntil = item.snoozedUntil ? new Date(item.snoozedUntil) : null;
  const isSnoozed = snoozedUntil !== null && snoozedUntil.getTime() > now.getTime();
  const isUrgent = item.severity === "critical" && !isSnoozed;

  return (
    <div
      id={`${listId}-item-${item.id}`}
      role="option"
      aria-selected={active}
      className={cn(
        "flex flex-col gap-2 border-b border-l-2 border-ink-400 border-l-transparent bg-ink-100 px-4 py-3",
        "transition-instant transition-colors",
        active && "bg-ink-200",
        isUrgent && "border-l-red-line",
        isSnoozed && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <div
            aria-hidden="true"
            className={cn(
              "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-sm border border-ink-400 bg-ink-200",
              isUrgent ? "text-red-fg" : "text-fg-200",
            )}
          >
            <Icon className="size-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-label font-medium text-fg-000">{item.title}</span>
              <Badge variant={SEVERITY_BADGE[item.severity]}>{item.severity}</Badge>
              <Badge variant="neutral">{meta.label}</Badge>
            </div>
            {item.description ? <p className="mt-0.5 text-meta text-fg-100">{item.description}</p> : null}
            {isSnoozed && snoozedUntil ? (
              <p className="mt-1 text-meta text-fg-200">Snoozed — returns {formatTimestamp(snoozedUntil)}</p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {item.assigneeName ? <Avatar size="sm" fallback={item.assigneeName.slice(0, 2).toUpperCase()} /> : null}
          <ScoreExplainer
            factors={{ itemType: item.itemType, severity: item.severity, createdAt: item.createdAt, magnitude: item.magnitude, entitySignal: item.entitySignal }}
            now={now}
          />
        </div>
      </div>

      <RowActions item={item} workspaceSlug={workspaceSlug} members={members} actions={actions} />
    </div>
  );
}
