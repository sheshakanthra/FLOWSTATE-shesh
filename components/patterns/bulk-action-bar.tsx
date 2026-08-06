"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, type LucideIcon } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";
import { base, instant, useReducedMotion } from "@/lib/motion";
import { Button, type ButtonVariant } from "@/components/ui/button";

export interface BulkAction {
  label: string;
  onClick: () => void;
  variant?: ButtonVariant;
  icon?: LucideIcon;
}

export interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  actions: BulkAction[];
  /** Singular noun for the count, e.g. "agent" -> "3 agents selected". */
  itemLabel?: string;
  className?: string;
}

/** Appears whenever a `DataTable` (or any other multi-select surface) has a nonzero selection. Positioning is the consumer's call — sticky at the bottom of the table, fixed to the viewport, etc. */
export function BulkActionBar({ count, onClear, actions, itemLabel = "item", className }: BulkActionBarProps) {
  const reducedMotion = useReducedMotion();
  const transition = reducedMotion ? instant : base;

  return (
    <AnimatePresence>
      {count > 0 ? (
        <motion.div
          role="toolbar"
          aria-label={`${count} ${itemLabel}${count === 1 ? "" : "s"} selected`}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          transition={transition}
          className={cn(
            "flex items-center gap-3 rounded-md border border-ink-500/60 bg-ink-300 py-2 pr-2 pl-4 text-fg-000",
            "shadow-floating backdrop-blur-[var(--blur-floating)]",
            className,
          )}
        >
          <span className="text-label font-medium tabular-nums">
            {count} {itemLabel}
            {count === 1 ? "" : "s"} selected
          </span>
          <div className="h-4 w-px bg-ink-500/60" aria-hidden="true" />
          <div className="flex items-center gap-1.5">
            {actions.map((action) => (
              <Button key={action.label} size="sm" variant={action.variant ?? "secondary"} onClick={action.onClick}>
                {action.icon ? <action.icon className="size-3.5" aria-hidden="true" /> : null}
                {action.label}
              </Button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear selection"
            className={cn(
              "ml-1 flex size-7 shrink-0 items-center justify-center rounded-sm text-fg-200",
              "transition-instant transition-colors hover:bg-ink-400 hover:text-fg-000",
              focusRing,
            )}
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
