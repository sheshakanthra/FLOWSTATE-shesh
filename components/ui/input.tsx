import * as React from "react";
import { cn, focusRing } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-control-height w-full rounded-sm border border-ink-400 bg-ink-100 px-3 text-body text-fg-000",
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

Input.displayName = "Input";
