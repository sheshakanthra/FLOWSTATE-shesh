"use client";

import * as React from "react";
import { motion } from "motion/react";
import { useMotion } from "@/lib/motion";

/**
 * Below-the-fold reveal for every marketing section (E1 spec item 6: "a
 * 12px-plus-fade scroll reveal at the `base` token, staggered 60ms, firing
 * once and never on scroll-back"). Not named in the spec's own file list,
 * but shared by four sections (logo wall, feature split, cta band, footer)
 * -- one IntersectionObserver-driven primitive here instead of the same
 * effect hand-rolled four times. Stays inside `features/marketing/` rather
 * than promoting to `components/ui`: every consumer is still this one
 * feature, so CLAUDE.md's "promote on the *second feature's* consumer"
 * threshold doesn't apply yet.
 *
 * `base` already collapses to a 90ms crossfade under reduced motion via
 * `useMotion()` (lib/motion.ts) -- no separate reduced-motion branch needed
 * here either.
 */
export interface ScrollRevealProps {
  children: React.ReactNode;
  /** Stagger offset in ms -- pass `index * 60` for items within one section. */
  delayMs?: number;
  className?: string;
}

export function ScrollReveal({ children, delayMs = 0, className }: ScrollRevealProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);
  const { base } = useMotion();

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={visible ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: base.duration, ease: base.ease, delay: delayMs / 1000 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
