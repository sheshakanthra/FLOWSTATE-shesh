import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The single pulsing primitive every shape-matched skeleton below is built
 * from. Pure CSS (`animate-pulse`, gated by `motion-reduce:` so reduced
 * motion drops straight to a static block) rather than framer-motion — a
 * skeleton has no direction/enter/exit to respect, so the shared `instant`
 * crossfade convention doesn't apply, and keeping this a Server Component
 * (no "use client") avoids forcing every screen that renders a loading
 * state into the client boundary just to read prefers-reduced-motion.
 */
export const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="presentation"
      aria-hidden="true"
      className={cn("animate-pulse rounded-sm bg-ink-200 motion-reduce:animate-none", className)}
      {...props}
    />
  ),
);
Skeleton.displayName = "Skeleton";

export interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number;
  lastLineWidth?: string;
}

/** Matches `text-body` line height so a swap-in of real copy never reflows. */
export const SkeletonText = React.forwardRef<HTMLDivElement, SkeletonTextProps>(
  ({ className, lines = 3, lastLineWidth = "60%", ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-2", className)} {...props}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className="h-3.5"
          style={{ width: index === lines - 1 ? lastLineWidth : "100%" }}
        />
      ))}
    </div>
  ),
);
SkeletonText.displayName = "SkeletonText";

export interface SkeletonRowProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: number;
  selectable?: boolean;
}

/** Shape-matched to a `DataTable` row: same `row-height`, an optional leading checkbox slot, and column-width cells. */
export const SkeletonRow = React.forwardRef<HTMLDivElement, SkeletonRowProps>(
  ({ className, columns = 4, selectable = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex h-row-height items-center gap-4 border-b border-ink-400 px-3",
        className,
      )}
      {...props}
    >
      {selectable ? <Skeleton className="size-4 shrink-0 rounded-sm" /> : null}
      {Array.from({ length: columns }, (_, index) => (
        <Skeleton
          key={index}
          className="h-3.5 flex-1"
          style={{ maxWidth: index === 0 ? "40%" : "20%" }}
        />
      ))}
    </div>
  ),
);
SkeletonRow.displayName = "SkeletonRow";

export type SkeletonCardProps = React.HTMLAttributes<HTMLDivElement>;

/** Shape-matched to `Card`: same border/radius/padding, a title-width bar, and a body paragraph. */
export const SkeletonCard = React.forwardRef<HTMLDivElement, SkeletonCardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-md border border-ink-400 bg-ink-100 p-card-padding", className)}
      {...props}
    >
      <div className="flex flex-col gap-1 pb-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
      <SkeletonText lines={2} lastLineWidth="40%" />
    </div>
  ),
);
SkeletonCard.displayName = "SkeletonCard";
