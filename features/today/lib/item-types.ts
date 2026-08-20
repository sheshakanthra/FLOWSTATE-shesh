import { AlertTriangle, Clock, DollarSign, TrendingDown, UserCheck, type LucideIcon } from "lucide-react";

/**
 * The five kinds of thing D1's queue ranks (spec scope item 1). Nothing
 * outside this session's slice — no CRM, project, or invoice items, per the
 * spec's own Out of scope.
 */
export type PriorityItemType =
  | "failed_run"
  | "human_approval"
  | "declining_success_rate"
  | "stale_draft"
  | "cost_spike";

export const PRIORITY_ITEM_TYPES: readonly PriorityItemType[] = [
  "failed_run",
  "human_approval",
  "declining_success_rate",
  "stale_draft",
  "cost_spike",
];

export type PrimaryActionKind = "retry" | "approve" | "review";

export interface ItemTypeMeta {
  label: string;
  icon: LucideIcon;
  /** The row's one contextual action beyond the universal snooze/delegate/
   *  open/resolve set (spec item 4) -- "Retry" makes sense for a failed
   *  run, "Approve" for a human-in-loop item, but neither means anything
   *  for a stale draft or a cost spike, which just get "Review" (opens the
   *  agent). */
  primaryAction: { kind: PrimaryActionKind; label: string };
  /** What `magnitude` (db/schema.ts's `priority_items.magnitude`) actually
   *  counts for this type -- shown verbatim in the score explainer so "the
   *  actual factor values" (gate item 2) reads as a real, named number, not
   *  an opaque one. */
  magnitudeLabel: string;
}

export const ITEM_TYPE_META: Record<PriorityItemType, ItemTypeMeta> = {
  failed_run: {
    label: "Failed run",
    icon: AlertTriangle,
    primaryAction: { kind: "retry", label: "Retry" },
    magnitudeLabel: "consecutive failures",
  },
  human_approval: {
    label: "Awaiting approval",
    icon: UserCheck,
    primaryAction: { kind: "approve", label: "Approve" },
    magnitudeLabel: "items waiting",
  },
  declining_success_rate: {
    label: "Declining success rate",
    icon: TrendingDown,
    primaryAction: { kind: "review", label: "Review" },
    magnitudeLabel: "points dropped",
  },
  stale_draft: {
    label: "Stale draft",
    icon: Clock,
    primaryAction: { kind: "review", label: "Review" },
    magnitudeLabel: "days overdue",
  },
  cost_spike: {
    label: "Cost spike",
    icon: DollarSign,
    primaryAction: { kind: "review", label: "Review" },
    magnitudeLabel: "% increase",
  },
};
