"use client";

import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import { useReducedMotion } from "@/lib/motion";
import { useRunStore } from "../store/run-store";
import type { CanvasEdge } from "../store/graph-store";

/**
 * Registered as the "default" edge type (edges never set their own `type`,
 * so this replaces React Flow's built-in bezier edge for every edge on the
 * canvas) specifically to add the "traveling pulse" session spec item 5
 * asks for on a running node's outgoing edges. An edge doesn't track its
 * own active/inactive state -- it just reads whether its *source* node is
 * currently `"running"` in run-store.ts, the single place that state lives.
 *
 * The pulse is a plain SVG `<animateMotion>` along the same bezier path
 * `<BaseEdge>` already draws, not a framer-motion loop -- no JS animation
 * frame work is needed to move a dot along a fixed path, and this is
 * naturally paused entirely (no dot rendered at all) under reduced motion,
 * satisfying that requirement by simply not rendering rather than needing
 * a separate reduced-motion branch.
 */
export function RunEdge({
  id,
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps<CanvasEdge>) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const sourceStatus = useRunStore((state) => state.nodeStatuses[source]);
  const isActive = sourceStatus === "running";
  const prefersReducedMotion = useReducedMotion();

  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      {isActive && !prefersReducedMotion ? (
        <circle r={3.5} className="fill-blue-fg" aria-hidden="true">
          <animateMotion dur="1.1s" repeatCount="indefinite" path={path} />
        </circle>
      ) : null}
    </>
  );
}
