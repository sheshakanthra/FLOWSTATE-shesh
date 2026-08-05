"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn, focusRing } from "@/lib/utils";

export interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  /** Accessible name for each thumb. Radix needs this on the Thumb itself,
   * not the Root, so a single Slider prop is exposed here and fanned out. */
  label: string | string[];
}

export const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
  ({ className, label, ...props }, ref) => (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none items-center select-none",
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-ink-400">
        <SliderPrimitive.Range className="absolute h-full bg-blue-fg" />
      </SliderPrimitive.Track>
      {(props.defaultValue ?? props.value ?? [0]).map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          aria-label={Array.isArray(label) ? label[index] : label}
          className={cn(
            "block size-4 rounded-full border-2 border-blue-fg bg-ink-000",
            "transition-instant transition-colors",
            focusRing,
          )}
        />
      ))}
    </SliderPrimitive.Root>
  ),
);

Slider.displayName = "Slider";
