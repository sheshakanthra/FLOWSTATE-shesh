"use client";

import * as React from "react";
import { registerContribution } from "./provider";
import type { ContextContribution } from "./envelope";

/** `useLayoutEffect` warns when React renders on the server, and every
 *  caller of this hook is a client component Next still server-renders
 *  first. Layout timing is what makes gate item 2's "within one frame" true
 *  — the contribution lands before the browser paints the interaction that
 *  caused it, not one frame later. */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/**
 * How a feature contributes to the copilot's context (spec item 4).
 *
 * ```tsx
 * useCopilotContext({
 *   id: "agent-builder",
 *   entity: { type: "agent", id: agentId, label: agent.name },
 * });
 * ```
 *
 * Registration is keyed on `contribution.id`, so re-registering replaces
 * rather than stacks, and the effect's teardown removes it entirely when the
 * component unmounts — which is the whole of gate item 6: navigating away
 * from an agent unmounts the builder, and the agent chip goes with it. No
 * feature ever has to remember to clear its own context.
 *
 * Callers pass an object literal; the hook compares it structurally so an
 * inline `{...}` doesn't re-register on every render. Pass `null` to
 * contribute nothing while still calling the hook unconditionally.
 */
export function useCopilotContext(contribution: ContextContribution | null): void {
  // Structural, not referential: a contribution is a small, JSON-shaped
  // object built the same way on every render, so serializing it is both a
  // reliable change signal and cheaper than asking every call site to
  // memoize by hand (and to keep that memo's deps correct forever).
  const serialized = contribution ? JSON.stringify(contribution) : null;

  useIsomorphicLayoutEffect(() => {
    if (serialized === null) return;
    return registerContribution(JSON.parse(serialized) as ContextContribution);
  }, [serialized]);
}
