"use client";

import * as React from "react";
import { useReactFlow } from "@xyflow/react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useMotion } from "@/lib/motion";
import { useCanvasStore } from "../store/canvas-store";
import { useGraphStore } from "../store/graph-store";
import { cloneGenericNodes, createGenericNode } from "../nodes/generic-node";
import { FIT_VIEW_PADDING } from "../lib/viewport";

export interface CanvasContextMenuProps {
  children: React.ReactNode;
}

/**
 * Canvas-level menu only -- right-clicking a node still bubbles up to this
 * (GenericNode doesn't stop propagation), since a node-specific menu is a
 * later session's job. Position for "Add node"/"Paste" comes from the raw
 * right-click event, captured here rather than read off Radix's own state
 * (it doesn't expose the triggering point to Content children).
 */
export function CanvasContextMenu({ children }: CanvasContextMenuProps) {
  const reactFlow = useReactFlow();
  const nodes = useGraphStore((state) => state.nodes);
  const addNode = useGraphStore((state) => state.addNode);
  const addNodes = useGraphStore((state) => state.addNodes);
  const setGraphSelection = useGraphStore((state) => state.setSelection);
  const clipboard = useCanvasStore((state) => state.clipboard);
  const setSelectedNodeIds = useCanvasStore((state) => state.setSelectedNodeIds);
  const { base } = useMotion();
  const duration = base.duration * 1000;

  const lastPointerRef = React.useRef({ x: 0, y: 0 });
  const handleContextMenu = React.useCallback((event: React.MouseEvent) => {
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  const selectExactly = React.useCallback(
    (ids: string[]) => {
      setGraphSelection(ids, []);
      setSelectedNodeIds(ids);
    },
    [setGraphSelection, setSelectedNodeIds],
  );

  const handleAddNode = React.useCallback(() => {
    const position = reactFlow.screenToFlowPosition(lastPointerRef.current);
    addNode(createGenericNode(position, "New node"));
  }, [reactFlow, addNode]);

  const handlePaste = React.useCallback(() => {
    if (!clipboard || clipboard.length === 0) return;
    const anchor = reactFlow.screenToFlowPosition(lastPointerRef.current);
    const pasted = cloneGenericNodes(clipboard, anchor);
    addNodes(pasted);
    selectExactly(pasted.map((node) => node.id));
  }, [clipboard, reactFlow, addNodes, selectExactly]);

  const handleSelectAll = React.useCallback(() => {
    selectExactly(nodes.map((node) => node.id));
  }, [nodes, selectExactly]);

  const handleFitView = React.useCallback(() => {
    reactFlow.fitView({ duration, padding: FIT_VIEW_PADDING });
  }, [reactFlow, duration]);

  const handleResetZoom = React.useCallback(() => {
    reactFlow.zoomTo(1, { duration });
  }, [reactFlow, duration]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={handleContextMenu}>
        <div className="size-full">{children}</div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={handleAddNode}>Add node</ContextMenuItem>
        <ContextMenuItem onSelect={handlePaste} disabled={!clipboard || clipboard.length === 0}>
          Paste
          <ContextMenuShortcut>⌘V</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={handleSelectAll} disabled={nodes.length === 0}>
          Select all
          <ContextMenuShortcut>⌘A</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={handleFitView}>
          Fit view
          <ContextMenuShortcut>⌘0</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleResetZoom}>Reset zoom</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
