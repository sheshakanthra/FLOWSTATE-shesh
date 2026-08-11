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
import { cloneNodes, createNode } from "../nodes/registry";
import { FIT_VIEW_PADDING } from "../lib/viewport";
import { registerGraphUndo } from "../lib/graph-undo";

export interface CanvasContextMenuProps {
  children: React.ReactNode;
  /** Id of the node that was right-clicked, or null for a blank-canvas
   *  right-click -- set by canvas/index.tsx's onNodeContextMenu/
   *  onPaneContextMenu, since Radix's ContextMenu has one shared trigger for
   *  the whole canvas and doesn't otherwise know which target was hit. */
  contextNodeId: string | null;
}

/**
 * One shared menu for the whole canvas -- right-clicking a node shows a
 * node-specific item set (Duplicate, Disable/Enable) in addition to the
 * canvas-level items, keyed off `contextNodeId` rather than a second Radix
 * tree, since Radix ContextMenu only supports one open menu per trigger
 * anyway. Position for "Add node"/"Paste" comes from the raw right-click
 * event, captured here rather than read off Radix's own state (it doesn't
 * expose the triggering point to Content children).
 */
export function CanvasContextMenu({ children, contextNodeId }: CanvasContextMenuProps) {
  const reactFlow = useReactFlow();
  const nodes = useGraphStore((state) => state.nodes);
  const addNode = useGraphStore((state) => state.addNode);
  const addNodes = useGraphStore((state) => state.addNodes);
  const setGraphSelection = useGraphStore((state) => state.setSelection);
  const toggleNodeDisabled = useGraphStore((state) => state.toggleNodeDisabled);
  const clipboard = useCanvasStore((state) => state.clipboard);
  const setSelectedNodeIds = useCanvasStore((state) => state.setSelectedNodeIds);
  const { base } = useMotion();
  const duration = base.duration * 1000;

  const contextNode = contextNodeId ? nodes.find((node) => node.id === contextNodeId) : undefined;

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
    const node = createNode("trigger", position);
    addNode(node);
    registerGraphUndo(
      "Added node",
      () => useGraphStore.getState().removeNodesWithEdges([node.id]),
      () => useGraphStore.getState().restoreFragment([node], []),
    );
  }, [reactFlow, addNode]);

  const handlePaste = React.useCallback(() => {
    if (!clipboard || clipboard.length === 0) return;
    const anchor = reactFlow.screenToFlowPosition(lastPointerRef.current);
    const pasted = cloneNodes(clipboard, anchor);
    addNodes(pasted);
    const ids = pasted.map((node) => node.id);
    selectExactly(ids);
    registerGraphUndo(
      pasted.length === 1 ? "Pasted node" : `Pasted ${pasted.length} nodes`,
      () => useGraphStore.getState().removeNodesWithEdges(ids),
      () => useGraphStore.getState().restoreFragment(pasted, []),
    );
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

  const handleDuplicateNode = React.useCallback(() => {
    if (!contextNode) return;
    const anchor = { x: contextNode.position.x + 24, y: contextNode.position.y + 24 };
    const duplicated = cloneNodes([contextNode], anchor);
    addNodes(duplicated);
    const ids = duplicated.map((node) => node.id);
    selectExactly(ids);
    registerGraphUndo(
      "Duplicated node",
      () => useGraphStore.getState().removeNodesWithEdges(ids),
      () => useGraphStore.getState().restoreFragment(duplicated, []),
    );
  }, [contextNode, addNodes, selectExactly]);

  const handleToggleDisabled = React.useCallback(() => {
    if (!contextNode) return;
    toggleNodeDisabled(contextNode.id);
  }, [contextNode, toggleNodeDisabled]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={handleContextMenu}>
        <div className="size-full">{children}</div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {contextNode ? (
          <>
            <ContextMenuItem onSelect={handleDuplicateNode}>
              Duplicate
              <ContextMenuShortcut>⌘D</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={handleToggleDisabled}>
              {contextNode.data.disabled ? "Enable node" : "Disable node"}
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        ) : null}
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
