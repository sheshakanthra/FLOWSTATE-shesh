"use client";

import * as React from "react";
import { toast } from "@/components/ui/toast";
import { pushUndoEntry, undo } from "./store";
import { useUndoShortcuts } from "./shortcuts";

export interface UndoableEntry {
  /** Human-readable, surfaced in the confirmation toast — e.g. "Deleted 3 tasks". */
  label: string;
  /** Reverts the mutation that already happened. */
  undo: () => void | Promise<void>;
  /** Re-applies it, for redo. */
  redo: () => void | Promise<void>;
}

/**
 * The undo substrate every mutation registers with. Mutations are expected
 * to run optimistically wherever they're triggered (a click handler, a
 * TanStack Query onMutate) — this hook doesn't run them, it registers the
 * already-applied change's inverse onto the global 100-step ring buffer,
 * shows the confirmation toast, and (via useUndoShortcuts) guarantees the
 * global ⌘Z/⌘⇧Z listener is bound for as long as any consumer is mounted.
 */
export function useUndoable(): (entry: UndoableEntry) => void {
  useUndoShortcuts();

  return React.useCallback((entry: UndoableEntry) => {
    pushUndoEntry({ id: crypto.randomUUID(), ...entry });
    toast({
      title: entry.label,
      action: { label: "Undo", onClick: () => undo() },
    });
  }, []);
}
