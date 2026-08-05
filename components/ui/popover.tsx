"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useOpenState } from "@/lib/use-open-state";
import { fast, instant, useReducedMotion } from "@/lib/motion";

const PopoverOpenContext = React.createContext(false);

export interface PopoverProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Root>,
    "open" | "defaultOpen" | "onOpenChange"
  > {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Popover({ open, defaultOpen, onOpenChange, children, ...props }: PopoverProps) {
  const [isOpen, setIsOpen] = useOpenState({ open, defaultOpen, onOpenChange });

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={setIsOpen} {...props}>
      <PopoverOpenContext.Provider value={isOpen}>{children}</PopoverOpenContext.Provider>
    </PopoverPrimitive.Root>
  );
}

export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, children, align = "center", sideOffset = 4, ...props }, ref) => {
  const open = React.useContext(PopoverOpenContext);
  const reducedMotion = useReducedMotion();
  const transition = reducedMotion ? instant : fast;

  return (
    <AnimatePresence>
      {open ? (
        <PopoverPrimitive.Portal forceMount>
          <PopoverPrimitive.Content
            ref={ref}
            asChild
            forceMount
            align={align}
            sideOffset={sideOffset}
            {...props}
          >
            <motion.div
              className={cn(
                "z-50 overflow-hidden rounded-md border border-ink-500/60 bg-ink-300 p-card-padding text-fg-000",
                "shadow-floating backdrop-blur-[var(--blur-floating)]",
                className,
              )}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
              transition={transition}
            >
              {children}
            </motion.div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      ) : null}
    </AnimatePresence>
  );
});
PopoverContent.displayName = "PopoverContent";
