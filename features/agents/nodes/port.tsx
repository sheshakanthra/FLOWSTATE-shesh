"use client";

import * as React from "react";
import { Handle, Position, useConnection } from "@xyflow/react";
import type { LucideIcon } from "lucide-react";
import { Asterisk, Braces, FileText, Type, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { arePortTypesCompatible, describeIncompatibility, type PortDef, type PortType } from "../lib/port-types";
import { useKeyboardConnectionState } from "../lib/keyboard-connection-store";
import { useGraphStore } from "../store/graph-store";
import { getNodeType } from "./registry";

/** One icon per port type instead of a color -- CLAUDE.md's semantic colors
 *  each have exactly one meaning already spoken for (emerald/amber/red/blue/
 *  violet), none of which is "port data shape," so port identity is
 *  achromatic and shape/icon-driven instead. */
const PORT_ICONS: Record<PortType, LucideIcon> = {
  text: Type,
  json: Braces,
  document: FileText,
  signal: Zap,
  any: Asterisk,
};

/** Handle defaults to absolute positioning pinned to the node's edge
 *  (Position.Left/Right in base.css, no `!important`) -- neutralized via
 *  inline style (which always wins over a plain class rule) so it renders
 *  as a small static dot; the actual edge placement (including even
 *  vertical spacing for multiple ports on one side) is done by this
 *  component's own wrapper instead, since React Flow only auto-spaces
 *  same-side handles if you position them yourself. */
const NEUTRAL_HANDLE_STYLE: React.CSSProperties = {
  position: "static",
  transform: "none",
  top: "auto",
  left: "auto",
  right: "auto",
  bottom: "auto",
};

export interface PortProps {
  nodeId: string;
  port: PortDef;
  direction: "input" | "output";
  /** This port's index and the total count of ports on the same side of the
   *  same node -- used to space multiple ports evenly along the edge. */
  index: number;
  total: number;
  isConnectable?: boolean;
}

export function Port({ nodeId, port, direction, index, total, isConnectable }: PortProps) {
  const Icon = PORT_ICONS[port.type];
  const handleType = direction === "input" ? "target" : "source";
  const position = direction === "input" ? Position.Left : Position.Right;

  // Selectors deliberately drop `pointer`/`to` (which change every pointer-
  // move frame during a drag) -- only `fromHandle` (set once, at drag start)
  // and `toHandle` (changes only when the hovered handle changes) are read,
  // so an in-progress drag doesn't re-render every port on every frame.
  const mouseSource = useConnection((connection) =>
    connection.inProgress
      ? { nodeId: connection.fromHandle.nodeId, portId: connection.fromHandle.id ?? "" }
      : null,
  );
  const mouseHoverTarget = useConnection((connection) =>
    connection.inProgress && connection.toHandle
      ? { nodeId: connection.toHandle.nodeId, portId: connection.toHandle.id ?? "" }
      : null,
  );
  const keyboardState = useKeyboardConnectionState();

  let source: { nodeId: string; portId: string } | null = null;
  let isHoverTarget = false;
  if (direction === "input") {
    if (mouseSource) {
      source = mouseSource;
      isHoverTarget = mouseHoverTarget?.nodeId === nodeId && mouseHoverTarget.portId === port.id;
    } else if (keyboardState.phase === "connecting") {
      source = { nodeId: keyboardState.nodeId, portId: keyboardState.portId };
      const candidate = keyboardState.candidates[keyboardState.activeIndex];
      isHoverTarget = candidate?.nodeId === nodeId && candidate?.portId === port.id;
    }
  }

  const isTargetOfActiveConnection = source !== null && source.nodeId !== nodeId;
  let sourceType: PortType | null = null;
  if (isTargetOfActiveConnection && source) {
    const sourceNode = useGraphStore.getState().nodes.find((node) => node.id === source!.nodeId);
    const sourceDef = sourceNode?.type ? getNodeType(sourceNode.type) : undefined;
    sourceType = sourceDef?.outputs.find((candidatePort) => candidatePort.id === source!.portId)?.type ?? null;
  }
  const isCompatible = !isTargetOfActiveConnection || !sourceType || arePortTypesCompatible(sourceType, port.type);
  const showReason = isTargetOfActiveConnection && isHoverTarget && !isCompatible && sourceType !== null;

  const isKeyboardFocused =
    keyboardState.phase === "port-focus" &&
    keyboardState.nodeId === nodeId &&
    keyboardState.side === direction &&
    keyboardState.portId === port.id;
  const isKeyboardConnectingFrom =
    keyboardState.phase === "connecting" && keyboardState.nodeId === nodeId && keyboardState.portId === port.id;

  const topPercent = total <= 1 ? 50 : ((index + 1) / (total + 1)) * 100;

  return (
    <div
      className="absolute flex items-center"
      style={{
        top: `${topPercent}%`,
        [direction === "input" ? "left" : "right"]: 0,
        transform: direction === "input" ? "translate(-50%, -50%)" : "translate(50%, -50%)",
      }}
      data-port-id={port.id}
    >
      <Handle
        id={port.id}
        type={handleType}
        position={position}
        isConnectable={isConnectable}
        style={NEUTRAL_HANDLE_STYLE}
        title={`${port.label} (${port.type})`}
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border bg-ink-200 text-fg-200",
          "transition-instant transition-colors",
          "border-ink-400",
          (isKeyboardFocused || isKeyboardConnectingFrom) && "border-blue-fg text-blue-fg",
          isTargetOfActiveConnection && isCompatible && "border-blue-fg text-blue-fg",
          isTargetOfActiveConnection && !isCompatible && "opacity-40",
        )}
      >
        <Icon className="size-2.5" aria-hidden="true" />
      </Handle>
      {showReason && sourceType ? (
        <div
          role="status"
          className={cn(
            "absolute top-1/2 z-20 w-max max-w-56 -translate-y-1/2 rounded-sm border border-red-line bg-ink-300 px-2 py-1",
            "text-meta text-red-fg shadow-floating",
            direction === "input" ? "left-full ml-2" : "right-full mr-2",
          )}
        >
          {describeIncompatibility(sourceType, port.type)}
        </div>
      ) : null}
    </div>
  );
}
