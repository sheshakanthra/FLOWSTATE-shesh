"use client";

import { Maximize, Minus, Plus } from "lucide-react";
import { Panel, useReactFlow } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { useMotion } from "@/lib/motion";
import { useCanvasStore } from "../store/canvas-store";
import { FIT_VIEW_PADDING } from "../lib/viewport";

/**
 * React Flow's own <Controls> ships a fixed white button stack with inline
 * default styling that survives CSS-variable overrides -- rebuilt here with
 * <Panel> (structural positioning only) and KILN <Button>, per the spec's
 * explicit "do not ship React Flow's default control bar."
 */
export function CanvasControls() {
  const reactFlow = useReactFlow();
  const zoom = useCanvasStore((state) => state.viewport.zoom);
  const { base } = useMotion();
  const duration = base.duration * 1000;

  return (
    <Panel
      position="bottom-left"
      className="!m-4 flex items-center gap-1 rounded-md border border-ink-400 bg-ink-200 p-1"
    >
      <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => reactFlow.zoomOut({ duration })}>
        <Minus className="size-4" aria-hidden="true" />
      </Button>
      <span data-testid="zoom-level" className="w-10 text-center text-meta text-fg-100 tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => reactFlow.zoomIn({ duration })}>
        <Plus className="size-4" aria-hidden="true" />
      </Button>
      <div className="mx-1 h-5 w-px bg-ink-500/60" aria-hidden="true" />
      <Button
        variant="ghost"
        size="icon"
        aria-label="Fit view"
        onClick={() => reactFlow.fitView({ duration, padding: FIT_VIEW_PADDING })}
      >
        <Maximize className="size-4" aria-hidden="true" />
      </Button>
    </Panel>
  );
}
