import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant = "neutral" | "emerald" | "amber" | "red" | "blue" | "violet";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: "border-ink-400 bg-ink-200 text-fg-100",
  emerald: "border-emerald-line bg-emerald-bg text-emerald-fg",
  amber: "border-amber-line bg-amber-bg text-amber-fg",
  red: "border-red-line bg-red-bg text-red-fg",
  blue: "border-blue-line bg-blue-bg text-blue-fg",
  violet: "border-violet-line bg-violet-bg text-violet-fg",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "neutral", ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-meta font-medium whitespace-nowrap",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  ),
);

Badge.displayName = "Badge";
