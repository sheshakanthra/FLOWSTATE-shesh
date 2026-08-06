"use client";

import * as React from "react";
import { cn, focusRing } from "@/lib/utils";
import { useResizable } from "@/lib/use-resizable";

export interface SplitPaneProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "id"> {
  /** Persistence key — the primary pane's size survives reload keyed on this id. */
  id: string;
  orientation?: "horizontal" | "vertical";
  defaultSize?: number;
  min?: number;
  max?: number;
  primary: React.ReactNode;
  secondary: React.ReactNode;
  handleLabel?: string;
}

/** Two panes sharing one draggable divider. The primary pane's size is persisted and constrained; the secondary pane fills the rest. */
export const SplitPane = React.forwardRef<HTMLDivElement, SplitPaneProps>(
  (
    {
      id,
      orientation = "horizontal",
      defaultSize = 320,
      min = 200,
      max = 720,
      primary,
      secondary,
      handleLabel,
      className,
      ...props
    },
    ref,
  ) => {
    const { size, handleProps } = useResizable({ id, defaultSize, min, max, orientation, invert: false });
    const isHorizontal = orientation === "horizontal";

    return (
      <div
        ref={ref}
        className={cn("flex h-full min-h-0 w-full min-w-0", !isHorizontal && "flex-col", className)}
        {...props}
      >
        <div
          className="min-h-0 min-w-0 shrink-0 overflow-auto"
          style={isHorizontal ? { width: size } : { height: size }}
        >
          {primary}
        </div>
        <div
          {...handleProps}
          aria-label={handleLabel ?? "Resize split"}
          className={cn(
            "relative shrink-0 bg-ink-400 transition-instant transition-colors hover:bg-blue-fg",
            isHorizontal ? "w-px cursor-ew-resize" : "h-px cursor-ns-resize",
            focusRing,
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "absolute",
              isHorizontal ? "inset-y-0 -left-1.5 -right-1.5" : "inset-x-0 -top-1.5 -bottom-1.5",
            )}
          />
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-auto">{secondary}</div>
      </div>
    );
  },
);
SplitPane.displayName = "SplitPane";
