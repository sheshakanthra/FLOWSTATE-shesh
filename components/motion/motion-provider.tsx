"use client";

import * as React from "react";
import {
  MotionContext,
  getReducedMotionServerSnapshot,
  getReducedMotionSnapshot,
  subscribeToReducedMotion,
} from "@/lib/motion";

export interface MotionProviderProps {
  children: React.ReactNode;
  /**
   * Overrides the detected OS/browser preference. Used by
   * .storybook/preview.tsx's "Motion" toolbar toggle so reduced-motion
   * behavior can be exercised without emulating the media feature at the
   * browser level. Leave unset in the real app — app/layout.tsx never
   * passes it, so production always reflects the actual preference.
   */
  forceReducedMotion?: boolean;
}

/**
 * Mounted once at the root (app/layout.tsx) and once per Storybook story
 * (.storybook/preview.tsx). The single place in the app that subscribes to
 * prefers-reduced-motion; every component reads the resolved value back out
 * through useReducedMotion()/useMotion() in lib/motion.ts instead.
 */
export function MotionProvider({ children, forceReducedMotion }: MotionProviderProps) {
  const detected = React.useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
  const prefersReducedMotion = forceReducedMotion ?? detected;

  return <MotionContext.Provider value={prefersReducedMotion}>{children}</MotionContext.Provider>;
}
