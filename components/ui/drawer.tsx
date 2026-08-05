"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";
import { useOpenState } from "@/lib/use-open-state";
import { base, instant, useReducedMotion } from "@/lib/motion";

export type DrawerSide = "left" | "right" | "top" | "bottom";

const SIDE_CONTAINER_CLASSES: Record<DrawerSide, string> = {
  right: "fixed inset-y-0 right-0 h-full w-96 max-w-[90vw] rounded-l-md",
  left: "fixed inset-y-0 left-0 h-full w-96 max-w-[90vw] rounded-r-md",
  top: "fixed inset-x-0 top-0 w-full h-96 max-h-[90vh] rounded-b-md",
  bottom: "fixed inset-x-0 bottom-0 w-full h-96 max-h-[90vh] rounded-t-md",
};

const SIDE_OFFSCREEN: Record<DrawerSide, { x?: string; y?: string }> = {
  right: { x: "100%" },
  left: { x: "-100%" },
  top: { y: "-100%" },
  bottom: { y: "100%" },
};

const DrawerOpenContext = React.createContext(false);
const DrawerSideContext = React.createContext<DrawerSide>("right");

export interface DrawerProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>,
    "open" | "defaultOpen" | "onOpenChange"
  > {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: DrawerSide;
}

export function Drawer({
  open,
  defaultOpen,
  onOpenChange,
  side = "right",
  children,
  ...props
}: DrawerProps) {
  const [isOpen, setIsOpen] = useOpenState({ open, defaultOpen, onOpenChange });

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={setIsOpen} {...props}>
      <DrawerOpenContext.Provider value={isOpen}>
        <DrawerSideContext.Provider value={side}>{children}</DrawerSideContext.Provider>
      </DrawerOpenContext.Provider>
    </DialogPrimitive.Root>
  );
}

export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;
export const DrawerTitle = DialogPrimitive.Title;
export const DrawerDescription = DialogPrimitive.Description;

export const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const open = React.useContext(DrawerOpenContext);
  const side = React.useContext(DrawerSideContext);
  const reducedMotion = useReducedMotion();
  const transition = reducedMotion ? instant : base;
  const offscreen = SIDE_OFFSCREEN[side];

  return (
    <AnimatePresence>
      {open ? (
        <DialogPrimitive.Portal forceMount>
          <DialogPrimitive.Overlay asChild forceMount>
            <motion.div
              className="fixed inset-0 z-50 bg-ink-000/70"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transition}
            />
          </DialogPrimitive.Overlay>
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
DrawerContent.displayName = "DrawerContent";

export const DrawerHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("mb-4 flex flex-col gap-1", className)} {...props} />
  ),
);
DrawerHeader.displayName = "DrawerHeader";

export const DrawerFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("mt-auto flex justify-end gap-2 pt-6", className)} {...props} />
  ),
);
DrawerFooter.displayName = "DrawerFooter";
