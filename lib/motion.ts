"use client";

import * as React from "react";

export interface MotionToken {
  duration: number;
  ease: [number, number, number, number];
}

export const instant: MotionToken = { duration: 0.09, ease: [0.2, 0, 0, 1] };
export const fast: MotionToken = { duration: 0.16, ease: [0.2, 0, 0, 1] };
export const base: MotionToken = { duration: 0.24, ease: [0.32, 0.72, 0, 1] };
export const slow: MotionToken = { duration: 0.38, ease: [0.32, 0.72, 0, 1] };

export interface SpringToken {
  type: "spring";
  stiffness: number;
  damping: number;
}

export const spring: SpringToken = { type: "spring", stiffness: 380, damping: 32 };

export const motion = { instant, fast, base, slow, spring } as const;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * The only place in the app that touches matchMedia — consumed exclusively
 * by MotionProvider's useSyncExternalStore call (components/motion/motion-provider.tsx).
 * Exported (not file-local) so that provider can live in components/ per
 * A4's file layout while this module keeps ownership of the subscription
 * plumbing, matching how every other motion export already lives here.
 */
export function subscribeToReducedMotion(callback: () => void): () => void {
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

export function getReducedMotionSnapshot(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function getReducedMotionServerSnapshot(): boolean {
  return false;
}

/**
 * Populated exactly once, at the root, by MotionProvider. Defaults to
 * `false` so a component rendered outside the provider degrades to "motion
 * allowed" rather than throwing — but in practice every render tree in this
 * app is wrapped (app/layout.tsx for the real app, .storybook/preview.tsx
 * for every story), so the default should never actually apply.
 */
export const MotionContext = React.createContext(false);

/**
 * Reads the resolved reduced-motion flag from context. This is the same
 * exported signature every A3 overlay (dialog, popover, toast, drawer,
 * sheet, hover-card, tooltip, dropdown-menu, context-menu, command-palette)
 * already calls — only the internals changed, from a per-component
 * matchMedia subscription to a single context read, per the A3 decision
 * that flagged this swap as A4's job. No call site needed to change.
 */
export function useReducedMotion(): boolean {
  return React.useContext(MotionContext);
}

export interface ResolvedMotion {
  instant: MotionToken;
  fast: MotionToken;
  base: MotionToken;
  slow: MotionToken;
  spring: SpringToken | MotionToken;
  prefersReducedMotion: boolean;
}

/**
 * Resolved motion tokens for the current reduced-motion state, already
 * zeroed out when needed, so components animate unconditionally off this
 * output instead of branching on the media query themselves. Under reduced
 * motion every tier — including spring, which has no duration of its own —
 * collapses to `instant`, the 90ms crossfade CLAUDE.md specifies.
 */
export function useMotion(): ResolvedMotion {
  const prefersReducedMotion = useReducedMotion();
  if (prefersReducedMotion) {
    return { instant, fast: instant, base: instant, slow: instant, spring: instant, prefersReducedMotion };
  }
  return { instant, fast, base, slow, spring, prefersReducedMotion };
}
