"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";
import { useOpenState } from "@/lib/use-open-state";
import { base, instant, useReducedMotion } from "@/lib/motion";

export type SheetSide = "left" | "right" | "top" | "bottom";

const SIDE_CONTAINER_CLASSES: Record<SheetSide, string> = {
  right: "fixed inset-y-0 right-0 h-full w-96 max-w-[90vw] rounded-l-md",
  left: "fixed inset-y-0 left-0 h-full w-96 max-w-[90vw] rounded-r-md",
  top: "fixed inset-x-0 top-0 w-full h-96 max-h-[90vh] rounded-b-md",
  bottom: "fixed inset-x-0 bottom-0 w-full h-96 max-h-[90vh] rounded-t-md",
};

const SIDE_OFFSCREEN: Record<SheetSide, { x?: string; y?: string }> = {
  right: { x: "100%" },
  left: { x: "-100%" },
  top: { y: "-100%" },
  bottom: { y: "100%" },
};

const SheetOpenContext = React.createContext(false);
const SheetSideContext = React.createContext<SheetSide>("right");

export interface SheetProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>,
    "open" | "defaultOpen" | "onOpenChange" | "modal"
  > {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: SheetSide;
}

/**
 * Non-modal counterpart to Drawer: same slide-in mechanics and edge/motion
 * tokens, but no backdrop scrim and no focus trap — an inline auxiliary
 * panel a feature can dock into (e.g. an inspector) without blocking the
 * rest of the page. modal is fixed to false, not exposed as a prop.
 */
export function Sheet({
  open,
  defaultOpen,
  onOpenChange,
  side = "right",
  children,
  ...props
}: SheetProps) {
  const [isOpen, setIsOpen] = useOpenState({ open, defaultOpen, onOpenChange });

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={setIsOpen} modal={false} {...props}>
      <SheetOpenContext.Provider value={isOpen}>
        <SheetSideContext.Provider value={side}>{children}</SheetSideContext.Provider>
      </SheetOpenContext.Provider>
    </DialogPrimitive.Root>
  );
}

export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const open = React.useContext(SheetOpenContext);
  const side = React.useContext(SheetSideContext);
  const reducedMotion = useReducedMotion();
  const transition = reducedMotion ? instant : base;
  const offscreen = SIDE_OFFSCREEN[side];

  return (
    <AnimatePresence>
      {open ? (
        <DialogPrimitive.Portal forceMount>
          <DialogPrimitive.Content ref={ref} asChild forceMount {...props}>
            <motion.div
              className={cn(
                "z-50 flex flex-col border border-ink-500/60 bg-ink-300 p-card-padding text-fg-000",
                "shadow-floating backdrop-blur-[var(--blur-floating)]",
                SIDE_CONTAINER_CLASSES[side],
                className,
              )}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, ...offscreen }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, x: 0, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, ...offscreen }}
              transition={transition}
            >
              {children}
              <DialogPrimitive.Close
                className={cn(
                  "absolute top-3 right-3 inline-flex size-6 items-center justify-center rounded-sm text-fg-200",
                  "transition-instant transition-colors hover:bg-ink-400 hover:text-fg-000",
                  focusRing,
                )}
              >
                <X className="size-4" aria-hidden="true" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      ) : null}
    </AnimatePresence>
  );
});
SheetContent.displayName = "SheetContent";

export const SheetHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("mb-4 flex flex-col gap-1", className)} {...props} />
  ),
);
SheetHeader.displayName = "SheetHeader";

export const SheetFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("mt-auto flex justify-end gap-2 pt-6", className)} {...props} />
  ),
);
SheetFooter.displayName = "SheetFooter";
