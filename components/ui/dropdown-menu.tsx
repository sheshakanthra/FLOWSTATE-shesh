"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, motion } from "motion/react";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOpenState } from "@/lib/use-open-state";
import { fast, instant, useReducedMotion } from "@/lib/motion";

const DropdownMenuOpenContext = React.createContext(false);

export interface DropdownMenuProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Root>,
    "open" | "defaultOpen" | "onOpenChange"
  > {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DropdownMenu({
  open,
  defaultOpen,
  onOpenChange,
  children,
  ...props
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useOpenState({ open, defaultOpen, onOpenChange });

  return (
    <DropdownMenuPrimitive.Root open={isOpen} onOpenChange={setIsOpen} {...props}>
      <DropdownMenuOpenContext.Provider value={isOpen}>{children}</DropdownMenuOpenContext.Provider>
    </DropdownMenuPrimitive.Root>
  );
}

export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, children, align = "start", sideOffset = 4, ...props }, ref) => {
  const open = React.useContext(DropdownMenuOpenContext);
  const reducedMotion = useReducedMotion();
  const transition = reducedMotion ? instant : fast;

  return (
    <AnimatePresence>
      {open ? (
        <DropdownMenuPrimitive.Portal forceMount>
          <DropdownMenuPrimitive.Content
            ref={ref}
            asChild
            forceMount
            align={align}
            sideOffset={sideOffset}
            {...props}
          >
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
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      ) : null}
    </AnimatePresence>
  );
});
DropdownMenuContent.displayName = "DropdownMenuContent";

const itemClass = cn(
  "relative flex h-control-height cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-2 text-body text-fg-000 select-none",
  "transition-instant transition-colors",
  "data-[highlighted]:bg-ink-200 data-[highlighted]:outline-none",
  "data-[disabled]:pointer-events-none data-[disabled]:text-fg-300 data-[disabled]:opacity-50",
);

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item ref={ref} className={cn(itemClass, className)} {...props} />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    checked={checked}
    className={cn(itemClass, "pl-8", className)}
    {...props}
  >
    <span className="absolute left-2 flex size-4 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="size-4 text-blue-fg" aria-hidden="true" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

export const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem ref={ref} className={cn(itemClass, "pl-8", className)} {...props}>
    <span className="absolute left-2 flex size-4 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="size-2 fill-blue-fg text-blue-fg" aria-hidden="true" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem";

export const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-meta text-fg-100", className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("my-1 h-px bg-ink-500/60", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

export function DropdownMenuShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("ml-auto flex items-center gap-1 pl-4 text-meta text-fg-200", className)}
      {...props}
    />
  );
}
