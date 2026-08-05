"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-ink-400 text-fg-000 border border-ink-500 hover:bg-ink-500 active:bg-ink-500",
  secondary:
    "bg-ink-100 text-fg-000 border border-ink-400 hover:bg-ink-200 active:bg-ink-200",
  ghost: "bg-transparent text-fg-000 border border-transparent hover:bg-ink-200 active:bg-ink-200",
  danger: "bg-red-bg text-red-fg border border-red-line hover:bg-red-line active:bg-red-line",
  link: "bg-transparent text-blue-fg border border-transparent underline-offset-4 hover:underline p-0! h-auto!",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-sm px-3 text-label",
  md: "h-control-height gap-2 rounded-md px-4 text-label",
  lg: "h-12 gap-2 rounded-md px-6 text-body",
  icon: "h-control-height w-control-height rounded-md p-0",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", loading = false, disabled, children, ...props },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={props.type ?? "button"}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading}
        data-loading={loading ? "" : undefined}
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center whitespace-nowrap font-sans text-label font-medium",
          "transition-instant transition-colors",
          "disabled:cursor-not-allowed disabled:opacity-50",
          focusRing,
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className,
        )}
        {...props}
      >
        <span className={cn("inline-flex items-center gap-2", loading && "invisible")}>
          {children}
        </span>
        {loading ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span className="sr-only">Loading</span>
          </span>
        ) : null}
      </button>
    );
  },
);

Button.displayName = "Button";
