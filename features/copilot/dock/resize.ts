"use client";

import { useResizable } from "@/lib/use-resizable";
import { DOCK_DEFAULT_WIDTH, DOCK_MAX_WIDTH, DOCK_MIN_WIDTH, DOCK_RESIZE_ID } from "./modes";

/**
 * The dock's width handle. A thin wrapper over `lib/use-resizable.ts` (A5)
 * rather than its own drag implementation — that hook already owns pointer
 * drag, arrow-key resizing, double-click reset, and `localStorage`
 * persistence keyed by id, which is the whole of what gate item 4 asks of
 * the width.
 *
 * `invert` is on because the handle sits on the dock's *left* edge while the
 * dock is anchored right: dragging left has to grow it, which is the
 * opposite of the hook's default delta direction. Same reasoning (and same
 * value) as `ResizablePanel`'s own `EDGE_INVERT.left`.
 */
export function useDockResize() {
  return useResizable({
    id: DOCK_RESIZE_ID,
    defaultSize: DOCK_DEFAULT_WIDTH,
    min: DOCK_MIN_WIDTH,
    max: DOCK_MAX_WIDTH,
    orientation: "horizontal",
    invert: true,
  });
}
