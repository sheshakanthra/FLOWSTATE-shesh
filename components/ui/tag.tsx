import * as React from "react";
import { X } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  onRemove?: () => void;
  removeLabel?: string;
  disabled?: boolean;
}

export const Tag = React.forwardRef<HTMLSpanElement, TagProps>(
  ({ className, children, onRemove, removeLabel = "Remove", disabled, ...props }, ref) => (
    <span
      ref={ref}
      aria-disabled={disabled || undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border border-ink-400 bg-ink-200 py-0.5 pl-2 text-label text-fg-100",
        onRemove ? "pr-1" : "pr-2",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      {...props}
    >
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={removeLabel}
          className={cn(
            "inline-flex size-4 items-center justify-center rounded-sm text-fg-200",
            "transition-instant transition-colors",
            "hover:bg-ink-400 hover:text-fg-000",
            "disabled:pointer-events-none",
            focusRing,
          )}
        >
          <X className="size-3" aria-hidden="true" />
        </button>
      ) : null}
    </span>
  ),
);

Tag.displayName = "Tag";
