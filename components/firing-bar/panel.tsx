"use client";

import * as React from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";
import { useMotion } from "@/lib/motion";
import type { FiringOperation } from "./types";

function useNow(intervalMs: number): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs]);
  return now;
}

function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

export interface FiringBarPanelProps {
  operations: FiringOperation[];
  onCancel: (id: string) => void;
}

export const FiringBarPanel = React.forwardRef<HTMLDivElement, FiringBarPanelProps>(
  ({ operations, onCancel }, ref) => {
    const { fast, instant, prefersReducedMotion } = useMotion();
    const transition = prefersReducedMotion ? instant : fast;
    const now = useNow(1000);

    return (
      <motion.div
        ref={ref}
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
        transition={transition}
        className={cn(
          "absolute top-full left-0 z-[60] w-full max-w-sm overflow-hidden",
          "rounded-md border border-ink-500/60 bg-ink-300 p-1 text-fg-000",
          "shadow-floating backdrop-blur-[var(--blur-floating)]",
        )}
      >
        {operations.length === 0 ? (
          <p className="px-3 py-4 text-center text-body text-fg-100">No operations running.</p>
        ) : (
          <ul aria-label="Live operations" className="flex flex-col gap-0.5">
            {operations.map((op) => (
              <li key={op.id} className="flex items-center gap-3 rounded-sm px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-label text-fg-000">{op.label}</p>
                  <p className="truncate text-meta text-fg-100">
                    {op.initiator} · {formatElapsed(now - op.startedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onCancel(op.id)}
                  aria-label={`Cancel ${op.label}`}
                  className={cn(
                    "inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-200",
                    "transition-instant transition-colors hover:bg-ink-400 hover:text-fg-000",
                    focusRing,
                  )}
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    );
  },
);
FiringBarPanel.displayName = "FiringBarPanel";
