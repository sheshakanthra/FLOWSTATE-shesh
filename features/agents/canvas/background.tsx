"use client";

import { Background, BackgroundVariant } from "@xyflow/react";

/**
 * Dots scale with zoom for free -- React Flow's own Background component
 * multiplies `gap`/`size` by the current transform internally, so no extra
 * wiring is needed here for that half of the requirement.
 *
 * Token choice: `--ink-050` ("sunken ... canvas backdrop" per its comment in
 * tokens.css) is the backdrop the dots sit on; `--ink-400` ("border-strong")
 * is the dot color itself, so the grid reads as a visible hairline mark
 * rather than nearly-invisible noise (ink-050 against ink-000/ink-050 is a
 * ~1.06:1 luminance delta -- not a functioning grid). Passed as `var(...)`
 * strings directly to the component's own color props rather than through a
 * CSS override, since those props accept any CSS color value.
 */
export function CanvasBackground() {
  return (
    <Background
      variant={BackgroundVariant.Dots}
      gap={24}
      size={1}
      color="var(--color-ink-400)"
      bgColor="var(--color-ink-050)"
    />
  );
}
