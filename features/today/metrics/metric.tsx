"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { useMotion } from "@/lib/motion";
import { Sparkline } from "./sparkline";

const COUNT_UP_MS = 900;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Gate item 5: "Count-up animates once on mount and never again on live
 * updates." A `hasAnimatedRef` flag, not a dependency-array trick, is what
 * makes "once" durable across however many times `value` changes after
 * that first animation finishes -- every subsequent change just snaps
 * `display` straight to the new number, no easing loop, matching "digits
 * do not shift width" (no animation means no intermediate, differently-
 * sized values flashing by; `tabular-nums` -- CLAUDE.md rule 6, applied
 * globally -- is what keeps the digits themselves from jittering during
 * the one real count-up). Reduced motion (gate item 6) skips the animation
 * loop entirely and renders the final value immediately.
 */
function useCountUp(value: number, enabled: boolean): number {
  const [display, setDisplay] = React.useState(enabled ? 0 : value);
  const hasAnimatedRef = React.useRef(false);

  React.useEffect(() => {
    if (!enabled || hasAnimatedRef.current) return;
    hasAnimatedRef.current = true;
    const start = performance.now();
    const target = value;
    let frame: number;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / COUNT_UP_MS);
      setDisplay(target * easeOutCubic(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // Deliberately mount-only -- see this hook's own doc comment.
  }, []);

  React.useEffect(() => {
    if (!enabled || hasAnimatedRef.current) setDisplay(value);
  }, [value, enabled]);

  return display;
}

export interface MetricProps {
  label: string;
  value: number;
  formatValue: (value: number) => string;
  sparklineValues: number[];
}

export function Metric({ label, value, formatValue, sparklineValues }: MetricProps) {
  const { prefersReducedMotion } = useMotion();
  const display = useCountUp(value, !prefersReducedMotion);

  return (
    <Card className="flex flex-col gap-2 p-card-padding">
      <span className="text-meta text-fg-200">{label}</span>
      <div className="flex items-end justify-between gap-2">
        <span className="text-title-lg text-fg-000">{formatValue(display)}</span>
        <Sparkline values={sparklineValues} />
      </div>
    </Card>
  );
}
