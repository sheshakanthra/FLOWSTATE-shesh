"use client";

import * as React from "react";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { AnimatePresence, motion } from "motion/react";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOpenState } from "@/lib/use-open-state";
import { fast, instant, useReducedMotion } from "@/lib/motion";

const ContextMenuOpenContext = React.createContext(false);

export interface ContextMenuProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Root>,
    "open" | "onOpenChange"
  > {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ContextMenu({ open, onOpenChange, children, ...props }: ContextMenuProps) {
  const [isOpen, setIsOpen] = useOpenState({ open, onOpenChange });

  return (
    <ContextMenuPrimitive.Root open={isOpen} onOpenChange={setIsOpen} {...props}>
      <ContextMenuOpenContext.Provider value={isOpen}>{children}</ContextMenuOpenContext.Provider>
    </ContextMenuPrimitive.Root>
  );
}

export const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
export const ContextMenuGroup = ContextMenuPrimitive.Group;
export const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;

export const ContextMenuContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const open = React.useContext(ContextMenuOpenContext);
  const reducedMotion = useReducedMotion();
  const transition = reducedMotion ? instant : fast;

  return (
    <AnimatePresence>
      {open ? (
        <ContextMenuPrimitive.Portal forceMount>
          <ContextMenuPrimitive.Content ref={ref} asChild forceMount {...props}>
            <motion.div
              className={cn(
                "z-50 min-w-40 overflow-hidden rounded-md border border-ink-500/60 bg-ink-300 p-1 text-fg-000",
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
          </ContextMenuPrimitive.Content>
        </ContextMenuPrimitive.Portal>
      ) : null}
    </AnimatePresence>
  );
});
ContextMenuContent.displayName = "ContextMenuContent";

const itemClass = cn(
  "relative flex h-control-height cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-2 text-body text-fg-000 select-none",
  "transition-instant transition-colors",
  "data-[highlighted]:bg-ink-200 data-[highlighted]:outline-none",
  "data-[disabled]:pointer-events-none data-[disabled]:text-fg-300 data-[disabled]:opacity-50",
);

export const ContextMenuItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Item ref={ref} className={cn(itemClass, className)} {...props} />
));
ContextMenuItem.displayName = "ContextMenuItem";

export const ContextMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <ContextMenuPrimitive.CheckboxItem
    ref={ref}
    checked={checked}
    className={cn(itemClass, "pl-8", className)}
    {...props}
  >
    <span className="absolute left-2 flex size-4 items-center justify-center">
      <ContextMenuPrimitive.ItemIndicator>
        <Check className="size-4 text-blue-fg" aria-hidden="true" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.CheckboxItem>
));
ContextMenuCheckboxItem.displayName = "ContextMenuCheckboxItem";

export const ContextMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.RadioItem ref={ref} className={cn(itemClass, "pl-8", className)} {...props}>
    <span className="absolute left-2 flex size-4 items-center justify-center">
      <ContextMenuPrimitive.ItemIndicator>
        <Circle className="size-2 fill-blue-fg text-blue-fg" aria-hidden="true" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.RadioItem>
));
ContextMenuRadioItem.displayName = "ContextMenuRadioItem";

export const ContextMenuLabel = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-meta text-fg-100", className)}
    {...props}
  />
));
ContextMenuLabel.displayName = "ContextMenuLabel";

export const ContextMenuSeparator = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator
    ref={ref}
    className={cn("my-1 h-px bg-ink-500/60", className)}
    {...props}
  />
));
ContextMenuSeparator.displayName = "ContextMenuSeparator";

export function ContextMenuShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("ml-auto flex items-center gap-1 pl-4 text-meta text-fg-200", className)}
      {...props}
    />
  );
}
