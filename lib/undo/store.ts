"use client";

import * as React from "react";

const RING_LIMIT = 100;

export interface UndoEntry {
  id: string;
  label: string;
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
}

let past: UndoEntry[] = [];
let future: UndoEntry[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/**
 * Pushes a new entry onto the undo stack and clears the redo stack — the
 * usual rule that a fresh action invalidates whatever was undone before it.
 * Caps at 100 entries, dropping the oldest.
 */
export function pushUndoEntry(entry: UndoEntry): void {
  past = [...past, entry].slice(-RING_LIMIT);
  future = [];
  emit();
}

export function undo(): UndoEntry | null {
  const entry = past.at(-1);
  if (!entry) return null;
  past = past.slice(0, -1);
  future = [...future, entry];
  void entry.undo();
  emit();
  return entry;
}

export function redo(): UndoEntry | null {
  const entry = future.at(-1);
  if (!entry) return null;
  future = future.slice(0, -1);
  past = [...past, entry];
  void entry.redo();
  emit();
  return entry;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The same subscription `useUndoStack` uses, exposed for non-React callers.
 * C1's copilot context registry watches the stack from module scope (not a
 * component) so observing new undo entries never re-renders the app shell —
 * matching how it subscribes to everything else it derives context from.
 */
export const subscribeToUndoStack = subscribe;

export function getUndoStackSnapshot(): UndoEntry[] {
  return past;
}

function getPastSnapshot(): UndoEntry[] {
  return past;
}

function getFutureSnapshot(): UndoEntry[] {
  return future;
}

const EMPTY: UndoEntry[] = [];
function getServerSnapshot(): UndoEntry[] {
  return EMPTY;
}

export function useUndoStack(): UndoEntry[] {
  return React.useSyncExternalStore(subscribe, getPastSnapshot, getServerSnapshot);
}

export function useRedoStack(): UndoEntry[] {
  return React.useSyncExternalStore(subscribe, getFutureSnapshot, getServerSnapshot);
}
