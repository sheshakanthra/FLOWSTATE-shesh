"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Module-level rather than a React context: the failure mode this guards
// against is two instances anywhere in the currently-rendered tree (most
// often direct siblings marking two "AI-authored" regions next to each
// other), not just nested descendants a context boundary would catch.
// DESIGN.md calls it "the single spectral hairline reserved for AI-authored
// content" — singular by design, so treating concurrent instances as a
// single shared count (rather than scoping to a subtree a caller would have
// to opt into with a dedicated provider, which nothing in this session's
// scope names) is the simpler rule that still matches that intent.
let activeCount = 0;

export interface SpectralHairlineProps {
  className?: string;
}

/**
 * The only gradient in the product. Marks AI-authored content exclusively —
 * warns in dev if more than one is mounted at once, since a second instance
 * means this signal is being reached for decoratively, which design rule #3
 * (CLAUDE.md) forbids.
 */
export function SpectralHairline({ className }: SpectralHairlineProps) {
  React.useEffect(() => {
    activeCount += 1;
    if (process.env.NODE_ENV !== "production" && activeCount > 1) {
      console.warn(
        "SpectralHairline is mounted more than once at the same time. " +
          "It exists solely to mark AI-authored content — there should only ever be one.",
      );
    }
    return () => {
      activeCount -= 1;
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={cn("h-px w-full", className)}
      style={{ backgroundImage: "var(--gradient-spectral)" }}
    />
  );
}
