"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";

export type StepStatus = "complete" | "current" | "upcoming" | "error";

export interface StepperStep {
  id: string;
  title: string;
  description?: string;
}

export interface StepperProps extends React.HTMLAttributes<HTMLOListElement> {
  steps: StepperStep[];
  currentStep: string;
  /** Marks one step (typically the current one) as failed instead of in-progress. */
  errorStep?: string;
  /** If provided, completed/errored steps become clickable buttons that jump back. */
  onStepClick?: (id: string) => void;
  orientation?: "horizontal" | "vertical";
}

function statusFor(index: number, currentIndex: number, isError: boolean): StepStatus {
  if (isError) return "error";
  if (index < currentIndex) return "complete";
  if (index === currentIndex) return "current";
  return "upcoming";
}

const INDICATOR_CLASSES: Record<StepStatus, string> = {
  complete: "border-emerald-fg bg-emerald-fg text-ink-000",
  current: "border-blue-fg bg-ink-100 text-blue-fg",
  upcoming: "border-ink-400 bg-ink-100 text-fg-100",
  error: "border-red-fg bg-red-fg text-ink-000",
};

const CONNECTOR_CLASSES: Record<StepStatus, string> = {
  complete: "bg-emerald-fg",
  current: "bg-ink-400",
  upcoming: "bg-ink-400",
  error: "bg-ink-400",
};

export const Stepper = React.forwardRef<HTMLOListElement, StepperProps>(
  (
    { steps, currentStep, errorStep, onStepClick, orientation = "horizontal", className, ...props },
    ref,
  ) => {
    const currentIndex = steps.findIndex((step) => step.id === currentStep);

    return (
      <ol
        ref={ref}
        className={cn(
          "flex",
          orientation === "horizontal" ? "w-full items-start" : "flex-col gap-3",
          className,
        )}
        {...props}
      >
        {steps.map((step, index) => {
          const status = statusFor(index, currentIndex, step.id === errorStep);
          const clickable = Boolean(onStepClick) && (status === "complete" || status === "error");
          const isLast = index === steps.length - 1;

          const indicator = (
            <span
              aria-hidden="true"
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-meta font-semibold",
                "transition-instant transition-colors",
                INDICATOR_CLASSES[status],
              )}
            >
              {status === "complete" ? (
                <Check className="size-3.5" strokeWidth={3} />
              ) : status === "error" ? (
                <X className="size-3.5" strokeWidth={3} />
              ) : (
                index + 1
              )}
            </span>
          );

          const label = (
            <span className="flex flex-col text-left">
              <span
                className={cn(
                  "text-label font-medium",
                  status === "upcoming" ? "text-fg-100" : "text-fg-000",
                )}
              >
                {step.title}
              </span>
              {step.description ? <span className="text-meta text-fg-100">{step.description}</span> : null}
            </span>
          );

          return (
            <li
              key={step.id}
              aria-current={status === "current" ? "step" : undefined}
              className={cn("flex items-center", orientation === "horizontal" && !isLast && "flex-1")}
            >
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick?.(step.id)}
                  className={cn("flex items-center gap-2 rounded-sm", focusRing)}
                >
                  {indicator}
                  {label}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  {indicator}
                  {label}
                </div>
              )}
              {orientation === "horizontal" && !isLast ? (
                <span className={cn("mx-3 h-px flex-1", CONNECTOR_CLASSES[status])} aria-hidden="true" />
              ) : null}
            </li>
          );
        })}
      </ol>
    );
  },
);
Stepper.displayName = "Stepper";
