"use client";

import * as React from "react";
import { cn, focusRing } from "@/lib/utils";
import { useResizable } from "@/lib/use-resizable";

export type ResizablePanelEdge = "left" | "right" | "top" | "bottom";

export interface ResizablePanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "id"> {
  /** Persistence key — size survives reload keyed on this id. */
  id: string;
  /** Which edge of the panel the drag handle sits on. */
  edge: ResizablePanelEdge;
  defaultSize?: number;
  min?: number;
  max?: number;
  handleLabel?: string;
}

const EDGE_ORIENTATION: Record<ResizablePanelEdge, "horizontal" | "vertical"> = {
  left: "horizontal",
  right: "horizontal",
  top: "vertical",
  bottom: "vertical",
};

// The handle sits on the panel's leading edge for "left"/"top" (the panel
// extends away from the handle), so dragging/arrowing forward there shrinks
// rather than grows — invert flips that back to the intuitive direction.
const EDGE_INVERT: Record<ResizablePanelEdge, boolean> = {
  left: true,
  right: false,
  top: true,
  bottom: false,
};

const EDGE_HANDLE_CLASSES: Record<ResizablePanelEdge, string> = {
  left: "top-0 left-0 h-full w-2.5 -translate-x-1/2 cursor-ew-resize",
  right: "top-0 right-0 h-full w-2.5 translate-x-1/2 cursor-ew-resize",
  top: "top-0 left-0 w-full h-2.5 -translate-y-1/2 cursor-ns-resize",
  bottom: "bottom-0 left-0 w-full h-2.5 translate-y-1/2 cursor-ns-resize",
};

/** A single panel with a resize handle on one edge — a sidebar or inspector against the edge of its container. For two panels sharing one handle, use `SplitPane`. */
export const ResizablePanel = React.forwardRef<HTMLDivElement, ResizablePanelProps>(
  (
    { id, edge, defaultSize = 280, min = 180, max = 560, handleLabel, className, style, children, ...props },
    ref,
  ) => {
    const orientation = EDGE_ORIENTATION[edge];
    const { size, handleProps } = useResizable({
      id,
      defaultSize,
      min,
      max,
      orientation,
      invert: EDGE_INVERT[edge],
    });

    return (
      <div
        ref={ref}
        className={cn("relative min-h-0 min-w-0 shrink-0", className)}
        style={{ ...(orientation === "horizontal" ? { width: size } : { height: size }), ...style }}
        {...props}
      >
        {children}
        <div
          {...handleProps}
          aria-label={handleLabel ?? "Resize panel"}
          className={cn(
            "absolute z-10 bg-transparent transition-instant transition-colors hover:bg-blue-fg/40",
            EDGE_HANDLE_CLASSES[edge],
            focusRing,
          )}
        />
      </div>
    );
  },
);
ResizablePanel.displayName = "ResizablePanel";
