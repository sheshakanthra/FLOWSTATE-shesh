"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useMotion } from "@/lib/motion";

const MIN_OPACITY = 0.12;
const MAX_OPACITY = 0.34;
const INDETERMINATE_MIN = 0.12;
const INDETERMINATE_MAX = 0.24;
const INDETERMINATE_DURATION_SECONDS = 1.8;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export interface EmberEdgeProps {
  /** 0-1 progress. Omit (or pass null) for indeterminate mode. */
  progress?: number | null;
  className?: string;
}

/**
 * 1px top-edge glow for running jobs, streaming, uploads. Deterministic
 * mode interpolates brightness 12% -> 34% white as `progress` goes 0 -> 1;
 * indeterminate mode pulses 12%-24% on an 1800ms loop. Under reduced
 * motion the pulse stops and the edge shows a fixed, static brightness.
 */
export function EmberEdge({ progress, className }: EmberEdgeProps) {
  const { base, instant, prefersReducedMotion } = useMotion();
  const indeterminate = progress === null || progress === undefined;
  const edgeClassName = cn("pointer-events-none absolute inset-x-0 top-0 h-px bg-ai-glow", className);

  if (indeterminate) {
    if (prefersReducedMotion) {
      return (
        <div
          aria-hidden="true"
          className={edgeClassName}
          style={{ opacity: (INDETERMINATE_MIN + INDETERMINATE_MAX) / 2 }}
        />
      );
    }
    return (
      <motion.div
        aria-hidden="true"
        className={edgeClassName}
        animate={{ opacity: [INDETERMINATE_MIN, INDETERMINATE_MAX, INDETERMINATE_MIN] }}
        transition={{ duration: INDETERMINATE_DURATION_SECONDS, repeat: Infinity, ease: "easeInOut" }}
      />
    );
  }

  const opacity = MIN_OPACITY + clamp01(progress) * (MAX_OPACITY - MIN_OPACITY);

  return (
    <motion.div
      aria-hidden="true"
      className={edgeClassName}
      animate={{ opacity }}
      transition={prefersReducedMotion ? instant : base}
    />
  );
}
