"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn, focusRing } from "@/lib/utils";

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-ink-400 bg-ink-400",
      "transition-instant transition-colors",
      "data-[state=checked]:border-blue-fg data-[state=checked]:bg-blue-fg",
      "aria-invalid:border-red-line",
      "disabled:cursor-not-allowed disabled:opacity-50",
      focusRing,
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "block size-3.5 translate-x-0.5 rounded-full bg-fg-000",
        "transition-instant transition-transform",
        "data-[state=checked]:translate-x-[20px]",
      )}
    />
  </SwitchPrimitive.Root>
));

Switch.displayName = "Switch";
