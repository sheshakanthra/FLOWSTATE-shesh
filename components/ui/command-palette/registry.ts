"use client";

import * as React from "react";
import type { Command } from "./types";

const scopes = new Map<string, Command[]>();
const listeners = new Set<() => void>();
let snapshot: Command[] = [];

function recompute(): void {
  snapshot = Array.from(scopes.values()).flat();
}

function emit(): void {
  for (const listener of listeners) listener();
}

/**
 * Registers a scope's commands into the palette. Later tracks call this
 * (directly, or via useCommands below) from anywhere in the tree without
 * touching this file. Returns an unregister function; calling it again with
 * the same scope replaces that scope's commands.
 */
export function registerCommands(scope: string, commands: Command[]): () => void {
  scopes.set(scope, commands);
  recompute();
  emit();
  return () => {
    scopes.delete(scope);
    recompute();
    emit();
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Command[] {
  return snapshot;
}

const EMPTY: Command[] = [];
function getServerSnapshot(): Command[] {
  return EMPTY;
}

export function useRegisteredCommands(): Command[] {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Convenience wrapper: registers `commands` under `scope` on mount and
 * unregisters automatically on unmount or when `scope`/`commands` change.
 * Callers should memoize `commands` (useMemo) — it's an effect dependency,
 * so a fresh array literal every render re-registers every render. Harmless
 * (recompute+emit is cheap) but wasteful.
 */
export function useCommands(scope: string, commands: Command[]): void {
  React.useEffect(() => registerCommands(scope, commands), [scope, commands]);
}
