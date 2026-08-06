"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useMotion } from "@/lib/motion";

export type ProgressVariant = "neutral" | "emerald" | "amber" | "red" | "blue";

const FILL_CLASSES: Record<ProgressVariant, string> = {
  neutral: "bg-fg-000",
  emerald: "bg-emerald-fg",
  amber: "bg-amber-fg",
  red: "bg-red-fg",
  blue: "bg-blue-fg",
};

const STROKE_CLASSES: Record<ProgressVariant, string> = {
  neutral: "stroke-fg-000",
  emerald: "stroke-emerald-fg",
  amber: "stroke-amber-fg",
  red: "stroke-red-fg",
  blue: "stroke-blue-fg",
};

export interface ProgressProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** 0-100. Omit for indeterminate. */
  value?: number;
  variant?: ProgressVariant;
  label?: string;
  showValue?: boolean;
}

/** Linear progress. Fill transitions on the `base` token; collapses to `instant` under reduced motion via `useMotion`. */
export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ value, variant = "blue", label, showValue = false, className, ...props }, ref) => {
    const { base, prefersReducedMotion } = useMotion();
    const clamped = value === undefined ? undefined : Math.min(100, Math.max(0, value));

    return (
      <div ref={ref} className={cn("flex flex-col gap-1.5", className)} {...props}>
        {label || showValue ? (
          <div className="flex items-center justify-between text-label text-fg-100">
            {label ? <span>{label}</span> : <span />}
            {showValue && clamped !== undefined ? (
              <span className="font-mono text-mono-sm">{Math.round(clamped)}%</span>
            ) : null}
          </div>
        ) : null}
        <div
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label ?? "Progress"}
          className="h-1.5 w-full overflow-hidden rounded-full bg-ink-200"
        >
          {clamped === undefined ? (
            prefersReducedMotion ? (
              <div className={cn("h-full w-1/3 rounded-full opacity-60", FILL_CLASSES[variant])} />
            ) : (
              <motion.div
                className={cn("h-full w-1/3 rounded-full", FILL_CLASSES[variant])}
                animate={{ x: ["-100%", "220%"] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
              />
            )
          ) : (
            <motion.div
              className={cn("h-full rounded-full", FILL_CLASSES[variant])}
              animate={{ width: `${clamped}%` }}
              transition={{ duration: base.duration, ease: base.ease }}
            />
          )}
        </div>
      </div>
    );
  },
);
Progress.displayName = "Progress";

export interface ProgressRadialProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** 0-100. Omit for indeterminate. */
  value?: number;
  size?: number;
  strokeWidth?: number;
  variant?: ProgressVariant;
  label?: string;
  showValue?: boolean;
}

/** Circular progress. Indeterminate spins the whole SVG rather than animating dash offset, so it stays a single smooth rotation. */
export const ProgressRadial = React.forwardRef<HTMLDivElement, ProgressRadialProps>(
  (
    { value, size = 40, strokeWidth = 4, variant = "blue", label, showValue = false, className, ...props },
    ref,
  ) => {
    const { base } = useMotion();
    const clamped = value === undefined ? undefined : Math.min(100, Math.max(0, value));
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = clamped === undefined ? circumference * 0.75 : circumference * (1 - clamped / 100);
    const center = size / 2;

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
        className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
        style={{ width: size, height: size }}
        {...props}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className={cn(clamped === undefined && "animate-spin motion-reduce:animate-none")}
        >
          <circle cx={center} cy={center} r={radius} strokeWidth={strokeWidth} className="fill-none stroke-ink-200" />
          <motion.circle
            cx={center}
            cy={center}
            r={radius}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            transform={`rotate(-90 ${center} ${center})`}
            className={cn("fill-none", STROKE_CLASSES[variant])}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: base.duration, ease: base.ease }}
          />
        </svg>
        {showValue && clamped !== undefined ? (
          <span className="absolute font-mono text-mono-sm text-fg-100">{Math.round(clamped)}%</span>
        ) : null}
      </div>
    );
  },
);
ProgressRadial.displayName = "ProgressRadial";
