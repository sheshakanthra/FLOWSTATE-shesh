"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useMotion } from "@/lib/motion";
import { EmberEdge } from "../motion/ember-edge";
import { FiringBarPanel } from "./panel";
import { cancelOperation, useFiringOperations } from "./store";

/**
 * The signature element: a 3px strip pinned above everything, invisible
 * when idle. Each concurrent operation gets an equal share of the width
 * (framer-motion's `layout` prop reflows the shares with a transform-based
 * animation, not a manual width recalculation, so this stays cheap at 12+
 * concurrent segments) and its own EmberEdge. Segments exit by collapsing
 * width, never by fading.
 *
 * The visual strip is aria-hidden — it's decoration, the real information
 * lives in the hover panel. A visually-hidden button gives keyboard users
 * the same panel via focus, since the strip itself has no other way to
 * receive focus.
 */
// Gate item 4 asks for something stricter than the usual reduced-motion
// crossfade here: Firing Bar segments must appear/disappear with no
// animation at all, not even the 90ms `instant` tier other components fall
// back to.
const NO_TRANSITION = { duration: 0 };

export function FiringBar() {
  const operations = useFiringOperations();
  const { base, prefersReducedMotion } = useMotion();
  const transition = prefersReducedMotion ? NO_TRANSITION : base;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const hasOperations = operations.length > 0;
  const segmentWidth = `${100 / Math.max(1, operations.length)}%`;

  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (!containerRef.current?.contains(event.relatedTarget as Node | null)) {
      setOpen(false);
    }
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-x-0 top-0 z-[60] h-3"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={handleBlur}
    >
      <div aria-hidden="true" className="flex h-[3px] w-full overflow-hidden">
        <AnimatePresence initial={false}>
          {operations.map((op) => (
            <motion.div
              key={op.id}
              layout
              initial={prefersReducedMotion ? false : { width: 0 }}
              animate={{ width: segmentWidth }}
              exit={{ width: 0 }}
              transition={transition}
              className="relative h-full shrink-0 bg-ink-500/60"
            >
              <EmberEdge progress={op.progress} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* No onClick: focus (below) already fires on click, before a click handler would. */}
      <button
        type="button"
        className={cn(
          "sr-only",
          "focus:not-sr-only focus:absolute focus:top-3 focus:left-2 focus:z-[60]",
          "focus:rounded-sm focus:border focus:border-ink-500/60 focus:bg-ink-300 focus:px-2 focus:py-1",
          "focus:text-label focus:text-fg-000 focus:outline focus:outline-2 focus:outline-blue-fg",
        )}
      >
        {hasOperations
          ? `${operations.length} operation${operations.length === 1 ? "" : "s"} running`
          : "No operations running"}
      </button>

      <AnimatePresence>
        {open && hasOperations ? (
          <FiringBarPanel operations={operations} onCancel={cancelOperation} />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export { useFiringBar, useFiringOperations, start, update, finish, cancelOperation } from "./store";
export type { FiringOperation, FiringStatus, StartOptions } from "./types";
