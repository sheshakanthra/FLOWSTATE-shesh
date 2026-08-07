"use client";

import * as React from "react";
import { Handle, Position, type Node, type NodeProps, type NodeTypes } from "@xyflow/react";
import { Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The one placeholder node type this session ships. Real node types (and
 * the registry that maps a node's `type` string to a component) are B2's
 * job -- this only exists so 300+ nodes have something to render for the
 * perf gate, and so the canvas isn't visually empty before B2 lands.
 */
export interface GenericNodeData extends Record<string, unknown> {
  label: string;
}

export type GenericNodeType = Node<GenericNodeData, "generic">;

/**
 * Handles are structurally required -- without at least one source and one
 * target handle, React Flow never computes `handleBounds` for the node, and
 * edges referencing it silently fail to render (verified against the
 * library source, not assumed). They're kept visually inert (zero opacity,
 * no pointer events) rather than styled as real ports: "ports or
 * connections" are explicitly out of scope for this session, and
 * `nodesConnectable={false}` on the root <ReactFlow> disables drag-to-connect
 * globally, so these never function as interactive ports -- they only exist
 * to give edges a valid attachment point.
 */
function GenericNodeComponent({ data, selected, isConnectable }: NodeProps<GenericNodeType>) {
  // Render-count instrumentation, not app behavior: e2e/canvas-benchmark.spec.ts
  // reads this to prove gate item 2 (panning produces zero node re-renders)
  // by diffing it across a pan gesture instead of requiring a human to drive
  // the React DevTools Profiler by hand. Cheap enough to leave live always.
  const renderCount = React.useRef(0);
  renderCount.current += 1;

  return (
    <div
      data-render-count={renderCount.current}
      className={cn(
        "flex h-11 min-w-[168px] items-center gap-2.5 rounded-lg border bg-ink-100 px-3 shadow-card",
        selected ? "border-blue-fg" : "border-ink-400",
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="!pointer-events-none !opacity-0"
      />
      <div
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-ink-200 text-fg-200"
      >
        <Workflow className="size-3.5" />
      </div>
      <span className="truncate text-label text-fg-000">{data.label}</span>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="!pointer-events-none !opacity-0"
      />
    </div>
  );
}

export const GenericNode = React.memo(GenericNodeComponent);
GenericNode.displayName = "GenericNode";

export const nodeTypes: NodeTypes = { generic: GenericNode };

let nodeCounter = 0;

/** Flow-position + label in, a ready-to-insert node out -- callers (empty
 *  state, context menu "Add node", paste) never hand-assemble a Node object. */
export function createGenericNode(
  position: { x: number; y: number },
  label: string,
): GenericNodeType {
  nodeCounter += 1;
  return {
    id: `node-${Date.now()}-${nodeCounter}`,
    type: "generic",
    position,
    data: { label },
  };
}

/** Clones a set of nodes (new ids, same relative layout) anchored so the
 *  first node lands at `anchor` -- the shared shape behind both the context
 *  menu's "Paste" (anchor = right-click point) and the ⌘V shortcut (anchor =
 *  a fixed offset from the originals), so the id-regeneration/offset math
 *  exists in exactly one place. */
export function cloneGenericNodes(
  nodes: GenericNodeType[],
  anchor: { x: number; y: number },
): GenericNodeType[] {
  const first = nodes[0];
  if (!first) return [];
  const originX = first.position.x;
  const originY = first.position.y;
  return nodes.map((node) =>
    createGenericNode(
      { x: anchor.x + (node.position.x - originX), y: anchor.y + (node.position.y - originY) },
      node.data.label,
    ),
  );
}
