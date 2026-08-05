"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";
import { useOpenState } from "@/lib/use-open-state";
import { base, instant, useReducedMotion } from "@/lib/motion";

const DialogOpenContext = React.createContext(false);

export interface DialogProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>,
    "open" | "defaultOpen" | "onOpenChange"
  > {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Dialog({ open, defaultOpen, onOpenChange, children, ...props }: DialogProps) {
  const [isOpen, setIsOpen] = useOpenState({ open, defaultOpen, onOpenChange });

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={setIsOpen} {...props}>
      <DialogOpenContext.Provider value={isOpen}>{children}</DialogOpenContext.Provider>
    </DialogPrimitive.Root>
  );
}

export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const open = React.useContext(DialogOpenContext);
  const reducedMotion = useReducedMotion();
  const transition = reducedMotion ? instant : base;

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
                "fixed top-1/2 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2",
                "rounded-xl border border-ink-500/60 bg-ink-300 p-card-padding text-fg-000",
                "shadow-floating backdrop-blur-[var(--blur-floating)]",
                className,
              )}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
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
DialogContent.displayName = "DialogContent";

export const DialogHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("mb-4 flex flex-col gap-1", className)} {...props} />
  ),
);
DialogHeader.displayName = "DialogHeader";

export const DialogFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("mt-6 flex justify-end gap-2", className)} {...props} />
  ),
);
DialogFooter.displayName = "DialogFooter";
