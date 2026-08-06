"use client";

import * as React from "react";

export type ResizeOrientation = "horizontal" | "vertical";

export interface UseResizableOptions {
  /** Storage key and, for SplitPane/ResizablePanel, the persistence identity of this panel. */
  id: string;
  defaultSize: number;
  min?: number;
  max?: number;
  /** "horizontal" = a vertical handle that changes width via left/right drag or arrow keys; "vertical" = a horizontal handle that changes height via up/down. */
  orientation: ResizeOrientation;
  /** Set when the handle sits on the leading edge of the panel it controls, so dragging/arrowing "forward" (right/down) should shrink rather than grow it. */
  invert?: boolean;
}

const STORAGE_PREFIX = "kiln:resizable:";
const KEYBOARD_STEP = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Shared drag/keyboard/persistence logic behind `ResizablePanel` and
 * `SplitPane`. Returns the current size plus a spread-able `handleProps`
 * bag (`role="separator"`, pointer + keyboard handlers, double-click
 * reset) so both components stay thin wrappers that only differ in layout.
 */
export function useResizable({ id, defaultSize, min = 0, max = Infinity, orientation, invert = false }: UseResizableOptions) {
  const [size, setSize] = React.useState(() => clamp(defaultSize, min, max));
  const dragOrigin = React.useRef<{ pos: number; size: number } | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_PREFIX + id);
    if (stored === null) return;
    const parsed = Number(stored);
    if (Number.isFinite(parsed)) setSize(clamp(parsed, min, max));
    // Reads persisted size once per panel identity; min/max intentionally
    // excluded so a later prop tweak doesn't re-trigger a storage re-read.
  }, [id]);

  const commit = React.useCallback(
    (next: number) => {
      const clamped = clamp(next, min, max);
      setSize(clamped);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_PREFIX + id, String(clamped));
      }
      return clamped;
    },
    [id, min, max],
  );

  const reset = React.useCallback(() => commit(defaultSize), [commit, defaultSize]);

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      dragOrigin.current = { pos: orientation === "horizontal" ? event.clientX : event.clientY, size };

      function handleMove(moveEvent: PointerEvent) {
        const origin = dragOrigin.current;
        if (!origin) return;
        const pos = orientation === "horizontal" ? moveEvent.clientX : moveEvent.clientY;
        const delta = pos - origin.pos;
        commit(origin.size + (invert ? -delta : delta));
      }
      function handleUp() {
        dragOrigin.current = null;
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      }
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [orientation, size, invert, commit],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const increaseKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
      const decreaseKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
      const step = invert ? -KEYBOARD_STEP : KEYBOARD_STEP;

      if (event.key === increaseKey) {
        event.preventDefault();
        commit(size + step);
      } else if (event.key === decreaseKey) {
        event.preventDefault();
        commit(size - step);
      } else if (event.key === "Home") {
        event.preventDefault();
        commit(min);
      } else if (event.key === "End" && Number.isFinite(max)) {
        event.preventDefault();
        commit(max);
      }
    },
    [orientation, invert, size, commit, min, max],
  );

  const handleProps = {
    role: "separator" as const,
    tabIndex: 0,
    "aria-valuenow": Math.round(size),
    "aria-valuemin": min,
    "aria-valuemax": Number.isFinite(max) ? max : undefined,
    "aria-orientation": (orientation === "horizontal" ? "vertical" : "horizontal") as "vertical" | "horizontal",
    onPointerDown: handlePointerDown,
    onKeyDown: handleKeyDown,
    onDoubleClick: reset,
  };

  return { size, handleProps, reset };
}
