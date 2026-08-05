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

function subscribeToReducedMotion(callback: () => void): () => void {
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

/**
 * Reads prefers-reduced-motion via matchMedia, subscribed with
 * useSyncExternalStore. This is intentionally not the root-context version
 * CLAUDE.md/DESIGN.md describe ("read once at the root and provided by
 * context") — that root provider is session A4's scope. Every overlay in A3
 * calls this hook directly instead; the zero-arg/boolean-return signature
 * stays stable so A4 can later swap the internals for a context read
 * without touching any call site.
 */
export function useReducedMotion(): boolean {
  return React.useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
}
