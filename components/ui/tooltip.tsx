"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { fast, instant, useReducedMotion } from "@/lib/motion";

const TooltipOpenContext = React.createContext(false);

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>) {
  const [isOpen, setIsOpen] = React.useState(props.defaultOpen ?? false);
  const open = props.open ?? isOpen;

  return (
    <TooltipPrimitive.Root
      {...props}
      onOpenChange={(next) => {
        setIsOpen(next);
        props.onOpenChange?.(next);
      }}
    >
      <TooltipOpenContext.Provider value={open}>{children}</TooltipOpenContext.Provider>
    </TooltipPrimitive.Root>
  );
}

export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, children, sideOffset = 6, ...props }, ref) => {
  const open = React.useContext(TooltipOpenContext);
  const reducedMotion = useReducedMotion();
  const transition = reducedMotion ? instant : fast;

  return (
    <AnimatePresence>
      {open ? (
        <TooltipPrimitive.Portal forceMount>
          <TooltipPrimitive.Content ref={ref} asChild forceMount sideOffset={sideOffset} {...props}>
            <motion.div
              className={cn(
                "z-50 rounded-md border border-ink-500/60 bg-ink-300 px-2 py-1 text-meta text-fg-000",
                "shadow-floating backdrop-blur-[var(--blur-floating)]",
                className,
              )}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 2 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 2 }}
              transition={transition}
            >
              {children}
              <TooltipPrimitive.Arrow className="fill-ink-300" />
            </motion.div>
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      ) : null}
    </AnimatePresence>
  );
});
TooltipContent.displayName = "TooltipContent";
