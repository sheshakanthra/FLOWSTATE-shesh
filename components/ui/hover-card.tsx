"use client";

import * as React from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { fast, instant, useReducedMotion } from "@/lib/motion";

const HoverCardOpenContext = React.createContext(false);

export function HoverCard({
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Root>) {
  const [isOpen, setIsOpen] = React.useState(props.defaultOpen ?? false);
  const open = props.open ?? isOpen;

  return (
    <HoverCardPrimitive.Root
      {...props}
      onOpenChange={(next) => {
        setIsOpen(next);
        props.onOpenChange?.(next);
      }}
    >
      <HoverCardOpenContext.Provider value={open}>{children}</HoverCardOpenContext.Provider>
    </HoverCardPrimitive.Root>
  );
}

export const HoverCardTrigger = HoverCardPrimitive.Trigger;

export const HoverCardContent = React.forwardRef<
  React.ElementRef<typeof HoverCardPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>
>(({ className, children, align = "center", sideOffset = 4, ...props }, ref) => {
  const open = React.useContext(HoverCardOpenContext);
  const reducedMotion = useReducedMotion();
  const transition = reducedMotion ? instant : fast;

  return (
    <AnimatePresence>
      {open ? (
        <HoverCardPrimitive.Portal forceMount>
          <HoverCardPrimitive.Content
            ref={ref}
            asChild
            forceMount
            align={align}
            sideOffset={sideOffset}
            {...props}
          >
            <motion.div
              className={cn(
                "z-50 w-72 overflow-hidden rounded-md border border-ink-500/60 bg-ink-300 p-card-padding text-fg-000",
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
          </HoverCardPrimitive.Content>
        </HoverCardPrimitive.Portal>
      ) : null}
    </AnimatePresence>
  );
});
HoverCardContent.displayName = "HoverCardContent";
