"use client";

import { MiniMap } from "@xyflow/react";

/**
 * Not a floating layer per DESIGN.md's enumerated list (dialog, popover,
 * command palette, dropdown) -- it's inset chrome on the canvas itself, like
 * Controls, so no drop shadow, just a hairline border and a raised surface.
 * `maskColor` needs an actual translucent value (the mask has to visibly
 * dim the off-viewport area without fully hiding node positions under it),
 * which none of the flat tokens provide on their own -- `color-mix()`
 * composes one from `--ink-000` without introducing a new raw color value.
 */
export function CanvasMiniMap() {
  return (
    <MiniMap
      pannable
      zoomable
      position="bottom-right"
      className="!m-4 !overflow-hidden !rounded-md !border !border-ink-400"
      bgColor="var(--color-ink-200)"
      maskColor="color-mix(in srgb, var(--color-ink-000) 65%, transparent)"
      nodeColor="var(--color-ink-400)"
      nodeStrokeColor="transparent"
      nodeBorderRadius={4}
      ariaLabel="Agent canvas minimap"
    />
  );
}
