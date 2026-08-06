import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "./button";

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: ButtonProps["variant"];
}

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon;
  title: string;
  /** One sentence naming the specific next action — never a shrug. */
  description: string;
  action: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon: Icon, title, description, action, secondaryAction, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center gap-3 rounded-md border border-dashed border-ink-400 px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-md border border-ink-400 bg-ink-200 text-fg-200"
      >
        <Icon className="size-5" />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-title-sm text-fg-000">{title}</h3>
        <p className="max-w-sm text-body text-fg-100">{description}</p>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button variant={action.variant ?? "primary"} onClick={action.onClick}>
          {action.label}
        </Button>
        {secondaryAction ? (
          <Button variant={secondaryAction.variant ?? "ghost"} onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        ) : null}
      </div>
    </div>
  ),
);
EmptyState.displayName = "EmptyState";
