"use client";

import * as React from "react";
import type { FiringOperation, FiringStatus, StartOptions } from "./types";

// How long a finished/cancelled segment stays visible (at full progress,
// its final status color) before it's actually removed and the collapse
// exit animation plays. Long enough to read as "done", short enough that
// the bar still feels responsive.
const EXIT_DELAY_MS = 600;

let operations: FiringOperation[] = [];
const listeners = new Set<() => void>();
const exitTimers = new Map<string, ReturnType<typeof setTimeout>>();

function emit(): void {
  for (const listener of listeners) listener();
}

function clearExitTimer(id: string): void {
  const timer = exitTimers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    exitTimers.delete(id);
  }
}

function remove(id: string): void {
  clearExitTimer(id);
  operations = operations.filter((op) => op.id !== id);
  emit();
}

/**
 * Registers a new async operation and returns its id. Plain function, not a
 * hook — callable from a server-action callback or a client mutation's
 * onMutate alike. Components that need to react to the live list use
 * useFiringOperations()/useFiringBar() below instead.
 */
export function start(options: StartOptions): string {
  const id = crypto.randomUUID();
  operations = [
    ...operations,
    { id, label: options.label, initiator: options.initiator, startedAt: Date.now(), progress: null, status: "running" },
  ];
  emit();
  return id;
}

export function update(id: string, progress: number): void {
  operations = operations.map((op) => (op.id === id ? { ...op, progress } : op));
  emit();
}

export function finish(id: string, status: FiringStatus = "success"): void {
  clearExitTimer(id);
  operations = operations.map((op) => (op.id === id ? { ...op, status, progress: 1 } : op));
  emit();
  exitTimers.set(id, setTimeout(() => remove(id), EXIT_DELAY_MS));
}

export function cancelOperation(id: string): void {
  finish(id, "cancelled");
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): FiringOperation[] {
  return operations;
}

const EMPTY: FiringOperation[] = [];
function getServerSnapshot(): FiringOperation[] {
  return EMPTY;
}

export function useFiringOperations(): FiringOperation[] {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export interface FiringBarApi {
  operations: FiringOperation[];
  start: (options: StartOptions) => string;
  update: (id: string, progress: number) => void;
  finish: (id: string, status?: FiringStatus) => void;
  cancel: (id: string) => void;
}

export function useFiringBar(): FiringBarApi {
  const liveOperations = useFiringOperations();
  return {
    operations: liveOperations,
    start,
    update,
    finish,
    cancel: cancelOperation,
  };
}
