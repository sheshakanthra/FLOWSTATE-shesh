"use client";

import { X } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";

export interface CopilotDockProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Empty for now — Track C fills this in. The width (380px) is the real
 * deliverable of this component: it's committed now so Track C reuses this
 * exact slot instead of relayouting the shell, which is what keeps gate item
 * 7 ("opening it in Track C must not reflow the page") true by construction
 * rather than by later retrofit.
 */
export function CopilotDock({ open, onClose }: CopilotDockProps) {
  return (
    <div
      aria-hidden={!open}
      className={cn(
        "h-full shrink-0 overflow-hidden border-l border-ink-400 bg-ink-050",
        "transition-[width] transition-base",
        open ? "w-[380px]" : "w-0 border-l-0",
      )}
    >
      <div className="flex h-full w-[380px] flex-col">
        <div className="flex h-control-height shrink-0 items-center justify-between border-b border-ink-400 px-3">
          <span className="text-label font-medium text-fg-000">Copilot</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close copilot"
            tabIndex={open ? 0 : -1}
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-sm text-fg-200",
              "transition-instant transition-colors hover:bg-ink-200 hover:text-fg-000",
              focusRing,
            )}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
