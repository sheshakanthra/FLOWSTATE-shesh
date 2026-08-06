import * as React from "react";
import { AlertTriangle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  /** What happened — specific, never "Something went wrong." */
  title: string;
  /** What to do next. */
  description: string;
  onRetry: () => void;
  retryLabel?: string;
}

/** red = critical/failed, per DESIGN.md's semantic color table — the one place ErrorState is allowed to carry it. */
export const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  (
    { icon: Icon = AlertTriangle, title, description, onRetry, retryLabel = "Try again", className, ...props },
    ref,
  ) => (
    <div
      ref={ref}
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-md border border-red-line bg-red-bg px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-md border border-red-line bg-ink-100 text-red-fg"
      >
        <Icon className="size-5" />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-title-sm text-fg-000">{title}</h3>
        <p className="max-w-sm text-body text-fg-100">{description}</p>
      </div>
      <Button className="mt-2" variant="secondary" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  ),
);
ErrorState.displayName = "ErrorState";
