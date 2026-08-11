"use client";

import { toast } from "@/components/ui/toast";
import { pushUndoEntry, undo } from "@/lib/undo/store";

/**
 * Every graph mutation in this feature (canvas/index.tsx, context-menu.tsx,
 * library/index.tsx, the Inspector) goes through one of the two functions
 * below rather than each calling `useUndoable()` itself. Two reasons:
 *
 * 1. `useUndoable()` is a hook -- fine inside a component's render body, but
 *    several call sites here are plain event handlers/store-adjacent
 *    functions where wiring a hook in cleanly would mean threading a
 *    `registerUndo` callback through props for no real benefit.
 * 2. `pushUndoEntry`/`undo` (lib/undo/store.ts) and `toast` are themselves
 *    plain functions -- `useUndoable()` only adds a ref-counted
 *    `useUndoShortcuts()` binding on top, which this feature guarantees
 *    once, at the AgentBuilder root (features/agents/builder.tsx), via a
 *    direct `useUndoShortcuts()` call. Replicating `useUndoable()`'s two
 *    plain-function calls here is equivalent, not a bypass.
 */
export function registerGraphUndo(label: string, undoFn: () => void, redoFn: () => void): void {
  pushUndoEntry({ id: crypto.randomUUID(), label, undo: undoFn, redo: redoFn });
  toast({ title: label, action: { label: "Undo", onClick: () => undo() } });
}

interface PendingEdit {
  key: string;
  label: string;
  before: unknown;
  latest: unknown;
  apply: (value: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

const IDLE_MS = 300;

let pending: PendingEdit | null = null;

function flushPending(): void {
  if (!pending) return;
  const { label, before, latest, apply } = pending;
  clearTimeout(pending.timer);
  pending = null;
  if (before === latest) return;
  registerGraphUndo(
    label,
    () => apply(before),
    () => apply(latest),
  );
}

/**
 * Coalesces a burst of rapid edits to the same field (typing into an Input,
 * dragging a Slider, a Select's onValueChange) into one undo step, per the
 * session spec's own note: "a 300ms idle window is a reasonable boundary."
 * Every call applies `after` immediately (so the canvas summary / live
 * config updates on every keystroke, not just at the end of the burst) --
 * only the undo *registration* is delayed and merged. `before` is only ever
 * used the first time a burst starts for a given `key`; later calls within
 * the same burst keep the original pre-burst value as the eventual undo
 * target, so callers can always just pass "the value right before this
 * change" without tracking burst state themselves.
 */
export function commitCoalescedEdit(params: {
  key: string;
  label: string;
  before: unknown;
  after: unknown;
  apply: (value: unknown) => void;
}): void {
  const { key, label, before, after, apply } = params;
  apply(after);

  if (pending && pending.key === key) {
    clearTimeout(pending.timer);
    pending.latest = after;
    pending.timer = setTimeout(flushPending, IDLE_MS);
    return;
  }

  flushPending();
  pending = { key, label, before, latest: after, apply, timer: setTimeout(flushPending, IDLE_MS) };
}

/** Forces any in-flight coalesced edit to resolve into an undo step
 *  immediately -- called on node-selection change and on the Inspector's
 *  unmount, so switching away from a field mid-edit doesn't strand it
 *  unregistered (or, worse, let a *different* field's later edit merge into
 *  it once the key no longer matches). */
export function flushCoalescedEdit(): void {
  flushPending();
}
