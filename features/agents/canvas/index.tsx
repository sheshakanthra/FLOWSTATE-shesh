"use client";

import * as React from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  type OnMove,
  type OnSelectionChangeFunc,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import { Zap } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useMotion } from "@/lib/motion";
import { useCanvasStore } from "../store/canvas-store";
import { useGraphStore } from "../store/graph-store";
import { cloneGenericNodes, createGenericNode, nodeTypes } from "../nodes/generic-node";
import { CanvasBackground } from "./background";
import { CanvasMiniMap } from "./minimap";
import { CanvasControls } from "./controls";
import { CanvasContextMenu } from "./context-menu";
import {
  FIT_VIEW_PADDING,
  MAX_ZOOM,
  MIN_ZOOM,
  VIRTUALIZATION_NODE_THRESHOLD,
  isCopyShortcut,
  isFitViewShortcut,
  isPasteShortcut,
  isSelectAllShortcut,
  isTypingTarget,
  isZoomInShortcut,
  isZoomOutShortcut,
} from "../lib/viewport";

/** Centered prompt over the (still interactive) grid rather than a blank
 *  canvas -- the grid stays panable/zoomable behind it. */
function CanvasEmptyState() {
  const reactFlow = useReactFlow();
  const addNode = useGraphStore((state) => state.addNode);

  const handleAddTrigger = React.useCallback(() => {
    const center = reactFlow.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    addNode(createGenericNode(center, "Trigger"));
  }, [reactFlow, addNode]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <EmptyState
        className="pointer-events-auto bg-ink-100"
        icon={Zap}
        title="Nothing runs yet"
        description="Every agent starts with a trigger — the event that kicks off a run. Add one to begin."
        action={{ label: "Add a trigger", onClick: handleAddTrigger }}
      />
    </div>
  );
}

function CanvasInner() {
  const reactFlow = useReactFlow();
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const onNodesChange = useGraphStore((state) => state.onNodesChange);
  const onEdgesChange = useGraphStore((state) => state.onEdgesChange);
  const setGraphSelection = useGraphStore((state) => state.setSelection);
  const { base } = useMotion();
  const duration = base.duration * 1000;

  /**
   * React Flow's own box-select always resets the selection the instant a
   * new drag starts (verified against the library source -- there is no
   * built-in additive mode), so "shift-drag adds to selection" is
   * implemented here: capture whether shift was held and what was already
   * selected at drag start, then union that base into every selection-change
   * event the drag produces.
   */
  const additiveBaseRef = React.useRef<Set<string>>(new Set());
  const isAdditiveDragRef = React.useRef(false);

  const handleSelectionStart = React.useCallback((event: React.MouseEvent) => {
    isAdditiveDragRef.current = event.shiftKey;
    additiveBaseRef.current = new Set(useCanvasStore.getState().selectedNodeIds);
    useCanvasStore.getState().setInteractionMode("selecting");
  }, []);

  const handleSelectionEnd = React.useCallback(() => {
    isAdditiveDragRef.current = false;
    useCanvasStore.getState().setInteractionMode("idle");
  }, []);

  const handleSelectionChange = React.useCallback<OnSelectionChangeFunc>(
    ({ nodes: selectedNodes, edges: selectedEdges }) => {
      const boxNodeIds = selectedNodes.map((node) => node.id);
      const finalNodeIds = isAdditiveDragRef.current
        ? Array.from(new Set([...additiveBaseRef.current, ...boxNodeIds]))
        : boxNodeIds;
      const edgeIds = selectedEdges.map((edge) => edge.id);
      setGraphSelection(finalNodeIds, edgeIds);
      useCanvasStore.getState().setSelectedNodeIds(finalNodeIds);
    },
    [setGraphSelection],
  );

  /**
   * Written straight to useCanvasStore's vanilla API, not read back into a
   * hook subscription in this component -- CanvasInner never subscribes to
   * `viewport`, so a 60Hz pan produces zero re-renders here. Only consumers
   * that actually display the viewport (CanvasControls' zoom readout)
   * subscribe to that slice, and only they re-render.
   */
  const handleMove = React.useCallback<OnMove>((_event, viewport) => {
    useCanvasStore.getState().setViewport(viewport);
  }, []);
  const handleMoveStart = React.useCallback(() => {
    useCanvasStore.getState().setInteractionMode("panning");
  }, []);
  const handleMoveEnd = React.useCallback(() => {
    useCanvasStore.getState().setInteractionMode("idle");
  }, []);

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;

      if (isZoomInShortcut(event)) {
        event.preventDefault();
        reactFlow.zoomIn({ duration });
      } else if (isZoomOutShortcut(event)) {
        event.preventDefault();
        reactFlow.zoomOut({ duration });
      } else if (isFitViewShortcut(event)) {
        event.preventDefault();
        reactFlow.fitView({ duration, padding: FIT_VIEW_PADDING });
      } else if (isSelectAllShortcut(event)) {
        event.preventDefault();
        const ids = useGraphStore.getState().nodes.map((node) => node.id);
        setGraphSelection(ids, []);
        useCanvasStore.getState().setSelectedNodeIds(ids);
      } else if (isCopyShortcut(event)) {
        const selected = useGraphStore.getState().nodes.filter((node) => node.selected);
        if (selected.length === 0) return;
        event.preventDefault();
        useCanvasStore.getState().setClipboard(selected);
      } else if (isPasteShortcut(event)) {
        const clipboard = useCanvasStore.getState().clipboard;
        const first = clipboard?.[0];
        if (!clipboard || !first) return;
        event.preventDefault();
        const anchor = { x: first.position.x + 40, y: first.position.y + 40 };
        const pasted = cloneGenericNodes(clipboard, anchor);
        useGraphStore.getState().addNodes(pasted);
        const ids = pasted.map((node) => node.id);
        setGraphSelection(ids, []);
        useCanvasStore.getState().setSelectedNodeIds(ids);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [reactFlow, duration, setGraphSelection]);

  return (
    <div className="relative size-full">
      <CanvasContextMenu>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onSelectionStart={handleSelectionStart}
          onSelectionEnd={handleSelectionEnd}
          onSelectionChange={handleSelectionChange}
          onMove={handleMove}
          onMoveStart={handleMoveStart}
          onMoveEnd={handleMoveEnd}
          selectionMode={SelectionMode.Full}
          nodesConnectable={false}
          deleteKeyCode={null}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          onlyRenderVisibleElements={nodes.length > VIRTUALIZATION_NODE_THRESHOLD}
          proOptions={{ hideAttribution: true }}
        >
          <CanvasBackground />
          <CanvasMiniMap />
          <CanvasControls />
        </ReactFlow>
      </CanvasContextMenu>
      {nodes.length === 0 ? <CanvasEmptyState /> : null}
    </div>
  );
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
