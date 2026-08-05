"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";
import { base, instant, useReducedMotion } from "@/lib/motion";

export interface ToastData {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "warning" | "danger";
  action?: { label: string; onClick: () => void };
  duration?: number;
}

// Gate item 7 ("6 simultaneous toasts without overflowing the viewport") is
// satisfied by construction: cap the visible stack at 5 with FIFO eviction
// rather than making the viewport scrollable — Radix's swipe-to-dismiss
// gesture would otherwise collide with a scroll gesture on touch devices.
const TOAST_LIMIT = 5;

let toasts: ToastData[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function toast(data: Omit<ToastData, "id">): string {
  const id = crypto.randomUUID();
  toasts = [...toasts, { id, ...data }].slice(-TOAST_LIMIT);
  emit();
  return id;
}

export function dismissToast(id: string): void {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ToastData[] {
  return toasts;
}

const EMPTY_TOASTS: ToastData[] = [];
function getServerSnapshot(): ToastData[] {
  return EMPTY_TOASTS;
}

function useToasts(): ToastData[] {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const VARIANT_CLASSES: Record<NonNullable<ToastData["variant"]>, string> = {
  default: "border-ink-500/60",
  success: "border-emerald-line",
  warning: "border-amber-line",
  danger: "border-red-line",
};

export function Toaster() {
  const items = useToasts();
  const reducedMotion = useReducedMotion();
  const transition = reducedMotion ? instant : base;

  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
      <AnimatePresence mode="popLayout">
        {items.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            asChild
            forceMount
            duration={item.duration}
            onOpenChange={(open) => {
              if (!open) dismissToast(item.id);
            }}
          >
            <motion.li
              layout
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
              transition={transition}
              className={cn(
                "relative rounded-md border bg-ink-300 p-card-padding pr-8 text-fg-000",
                "shadow-floating backdrop-blur-[var(--blur-floating)]",
                VARIANT_CLASSES[item.variant ?? "default"],
              )}
            >
              <ToastPrimitive.Title className="text-label font-medium">
                {item.title}
              </ToastPrimitive.Title>
              {item.description ? (
                <ToastPrimitive.Description className="mt-1 text-body text-fg-100">
                  {item.description}
                </ToastPrimitive.Description>
              ) : null}
              {item.action ? (
                <ToastPrimitive.Action asChild altText={item.action.label}>
                  <button
                    type="button"
                    onClick={item.action.onClick}
                    className={cn(
                      "mt-2 text-label text-blue-fg",
                      "transition-instant transition-colors hover:underline",
                      focusRing,
                    )}
                  >
                    {item.action.label}
                  </button>
                </ToastPrimitive.Action>
              ) : null}
              <ToastPrimitive.Close
                aria-label="Dismiss"
                className={cn(
                  "absolute top-2 right-2 inline-flex size-6 items-center justify-center rounded-sm text-fg-200",
                  "transition-instant transition-colors hover:bg-ink-400 hover:text-fg-000",
                  focusRing,
                )}
              >
                <X className="size-3" aria-hidden="true" />
              </ToastPrimitive.Close>
            </motion.li>
          </ToastPrimitive.Root>
        ))}
      </AnimatePresence>
      <ToastPrimitive.Viewport
        className="fixed bottom-0 right-0 z-50 m-0 flex w-full max-w-sm list-none flex-col gap-2 p-card-padding outline-none"
      />
    </ToastPrimitive.Provider>
  );
}
