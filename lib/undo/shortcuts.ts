"use client";

import * as React from "react";
import { redo, undo } from "./store";

// Ref-counted module-level binding: every useUndoable() caller mounts this,
// but the document keydown listener itself must only ever be attached once
// regardless of how many components are using the undo substrate at once.
let refCount = 0;
let unbind: (() => void) | null = null;

function handleKeyDown(event: KeyboardEvent): void {
  const isModifier = event.metaKey || event.ctrlKey;
  if (!isModifier || event.key.toLowerCase() !== "z") return;
  event.preventDefault();
  if (event.shiftKey) redo();
  else undo();
}

function bind(): () => void {
  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}

/** Binds the global ⌘Z / ⌘⇧Z shortcuts once, however many callers mount it. */
export function useUndoShortcuts(): void {
  React.useEffect(() => {
    refCount += 1;
    if (refCount === 1) unbind = bind();
    return () => {
      refCount -= 1;
      if (refCount === 0) {
        unbind?.();
        unbind = null;
      }
    };
  }, []);
}
