import * as React from "react";
import { cn } from "@/lib/utils";

export type KbdProps = React.HTMLAttributes<HTMLElement>;

export const Kbd = React.forwardRef<HTMLElement, KbdProps>(({ className, ...props }, ref) => (
  <kbd
    ref={ref}
    className={cn(
      "inline-flex min-w-5 items-center justify-center rounded-sm border border-ink-400 bg-ink-200 px-1.5 font-mono text-mono-sm text-fg-100",
      className,
    )}
    {...props}
  />
));

Kbd.displayName = "Kbd";
