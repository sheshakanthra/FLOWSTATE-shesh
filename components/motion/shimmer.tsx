"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useMotion } from "@/lib/motion";

const LOOP_DURATION_SECONDS = 2.4;
const PEAK_OPACITY = 0.08;

export interface ShimmerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * Wraps any surface where an agent is currently working. The whole surface
 * breathes with a slow, barely-perceptible luminance pulse — not a moving
 * gradient band, which would read as a loading skeleton rather than the
 * ambient "heat haze" DESIGN.md asks for. Under reduced motion it renders a
 * static "Working" chip instead of animating.
 */
export const Shimmer = React.forwardRef<HTMLDivElement, ShimmerProps>(
  ({ children, className, ...props }, ref) => {
    const { prefersReducedMotion } = useMotion();

    return (
      <div ref={ref} className={cn("relative isolate", className)} {...props}>
        {children}
        {prefersReducedMotion ? (
          <span
            className={cn(
              "pointer-events-none absolute top-2 right-2 inline-flex items-center rounded-sm border",
              "border-ink-400 bg-ink-200 px-1.5 py-0.5 text-meta font-medium text-fg-100",
            )}
          >
            Working
          </span>
        ) : (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit] bg-ai-glow"
            animate={{ opacity: [0, PEAK_OPACITY, 0] }}
            transition={{ duration: LOOP_DURATION_SECONDS, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>
    );
  },
);
Shimmer.displayName = "Shimmer";
