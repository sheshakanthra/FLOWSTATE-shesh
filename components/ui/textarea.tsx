import * as React from "react";
import { cn, focusRing } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 4, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          "w-full resize-y rounded-sm border border-ink-400 bg-ink-100 px-3 py-2 text-body text-fg-000",
          "placeholder:text-fg-300",
          "transition-instant transition-colors",
          "hover:border-ink-500",
          "aria-invalid:border-red-line aria-invalid:text-red-fg",
          "disabled:cursor-not-allowed disabled:bg-ink-050 disabled:text-fg-300 disabled:opacity-50",
          focusRing,
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";
