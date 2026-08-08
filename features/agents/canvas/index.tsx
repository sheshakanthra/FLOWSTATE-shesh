"use client";

import * as React from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  type Connection,
  type OnConnect,
  type OnMove,
  type OnSelectionChangeFunc,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import { Zap } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { useMotion } from "@/lib/motion";
import { useCanvasStore } from "../store/canvas-store";
import { useGraphStore, type CanvasEdge } from "../store/graph-store";
import { cloneNodes, createNode, generateEdgeId, getNodeType, nodeTypes } from "../nodes/registry";
import { arePortTypesCompatible } from "../lib/port-types";
import { findCycle } from "../lib/cycle-detect";
import { isTypeCompatibleConnection, validateConnection } from "../lib/validation";
import {
  getKeyboardConnectionState,
  resetKeyboardConnection,
  setKeyboardConnectionState,
  type PortCandidate,
} from "../lib/keyboard-connection-store";
import { CanvasBackground } from "./background";
import { CanvasMiniMap } from "./minimap";
import { CanvasControls } from "./controls";
import { CanvasContextMenu } from "./context-menu";
import { NodeLibraryPanel, NODE_LIBRARY_DRAG_MIME } from "../library";
import {
  FIT_VIEW_PADDING,
  MAX_ZOOM,
  MIN_ZOOM,
  VIRTUALIZATION_NODE_THRESHOLD,
  isCopyShortcut,
  isDuplicateShortcut,
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
    addNode(createNode("trigger", center));
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

  const [contextNodeId, setContextNodeId] = React.useState<string | null>(null);

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

  /**
   * Type compatibility only -- cheap enough to run on every hovered handle
   * during a drag. Blocking the drop here is also what drives Port's
   * pre-attempt desaturation/reason (via useConnection()), since React Flow
   * refuses to complete a connection this returns false for.
   */
  const handleIsValidConnection = React.useCallback((connection: Connection | CanvasEdge) => {
    return isTypeCompatibleConnection(connection, useGraphStore.getState().nodes);
  }, []);

  /**
   * Cycle rejection happens here, not in isValidConnection: it needs the
   * full edge list (graph-global), so it's checked once on drop rather than
   * on every hovered handle, and reported as a toast naming the cycle
   * (gate item 3) rather than silently refusing the drop like a type
   * mismatch does.
   */
  const handleConnect = React.useCallback<OnConnect>((connection) => {
    const state = useGraphStore.getState();
    const result = validateConnection(connection, state.nodes, state.edges);
    if (!result.valid) {
      toast({ title: "Connection rejected", description: result.reason, variant: "danger" });
      return;
    }
    state.addEdges([
      {
        id: generateEdgeId(),
        source: connection.source,
        sourceHandle: connection.sourceHandle,
        target: connection.target,
        targetHandle: connection.targetHandle,
      },
    ]);
  }, []);

  const handleDragOver = React.useCallback((event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes(NODE_LIBRARY_DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = React.useCallback(
    (event: React.DragEvent) => {
      const typeId = event.dataTransfer.getData(NODE_LIBRARY_DRAG_MIME);
      if (!typeId) return;
      event.preventDefault();
      const position = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const node = createNode(typeId, position);
      useGraphStore.getState().addNode(node);
      setGraphSelection([node.id], []);
      useCanvasStore.getState().setSelectedNodeIds([node.id]);
    },
    [reactFlow, setGraphSelection],
  );

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
        const pasted = cloneNodes(clipboard, anchor);
        useGraphStore.getState().addNodes(pasted);
        const ids = pasted.map((node) => node.id);
        setGraphSelection(ids, []);
        useCanvasStore.getState().setSelectedNodeIds(ids);
      } else if (isDuplicateShortcut(event)) {
        const selected = useGraphStore.getState().nodes.filter((node) => node.selected);
        const first = selected[0];
        if (!first) return;
        event.preventDefault();
        const anchor = { x: first.position.x + 24, y: first.position.y + 24 };
        const duplicated = cloneNodes(selected, anchor);
        useGraphStore.getState().addNodes(duplicated);
        const ids = duplicated.map((node) => node.id);
        setGraphSelection(ids, []);
        useCanvasStore.getState().setSelectedNodeIds(ids);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [reactFlow, duration, setGraphSelection]);

  /**
   * Gate item 6: the keyboard connection path. Runs in the *capture* phase
   * and calls stopPropagation() for every key it consumes -- React Flow
   * binds its own default arrow-key node-move handling directly on each
   * node, in the bubble phase, so a document-level bubble listener (like the
   * shortcut handler above) would always run too late to preempt it. A
   * capture-phase listener runs before the event ever reaches the node, so
   * stopPropagation() here reliably stops it from moving the focused node
   * instead of walking our candidate list.
   */
  React.useEffect(() => {
    function handleKeyDownCapture(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;
      const keyboardState = getKeyboardConnectionState();
      const currentNodes = useGraphStore.getState().nodes;
      const currentEdges = useGraphStore.getState().edges;

      if (keyboardState.phase === "idle") {
        if (event.key !== "Enter") return;
        const activeElement = document.activeElement;
        const nodeElement = activeElement instanceof HTMLElement ? activeElement.closest(".react-flow__node") : null;
        const nodeId = nodeElement?.getAttribute("data-id");
        if (!nodeId) return;
        const node = currentNodes.find((candidate) => candidate.id === nodeId);
        if (!node?.type) return;
        const definition = getNodeType(node.type);
        if (!definition || (definition.inputs.length === 0 && definition.outputs.length === 0)) return;
        event.preventDefault();
        event.stopPropagation();
        const side: "output" | "input" = definition.outputs.length > 0 ? "output" : "input";
        const ports = side === "output" ? definition.outputs : definition.inputs;
        const firstPort = ports[0];
        if (!firstPort) return;
        setKeyboardConnectionState({ phase: "port-focus", nodeId, side, portId: firstPort.id });
        return;
      }

      if (keyboardState.phase === "port-focus") {
        const node = currentNodes.find((candidate) => candidate.id === keyboardState.nodeId);
        const definition = node?.type ? getNodeType(node.type) : undefined;
        if (!definition) {
          resetKeyboardConnection();
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          resetKeyboardConnection();
          return;
        }

        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          event.stopPropagation();
          const nextSide = keyboardState.side === "output" ? "input" : "output";
          const nextPorts = nextSide === "output" ? definition.outputs : definition.inputs;
          const nextPort = nextPorts[0];
          if (nextPort) {
            setKeyboardConnectionState({ phase: "port-focus", nodeId: keyboardState.nodeId, side: nextSide, portId: nextPort.id });
          }
          return;
        }

        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          event.stopPropagation();
          const ports = keyboardState.side === "output" ? definition.outputs : definition.inputs;
          const currentIndex = ports.findIndex((port) => port.id === keyboardState.portId);
          const delta = event.key === "ArrowDown" ? 1 : -1;
          const nextIndex = (currentIndex + delta + ports.length) % ports.length;
          const nextPort = ports[nextIndex];
          if (nextPort) {
            setKeyboardConnectionState({ ...keyboardState, portId: nextPort.id });
          }
          return;
        }

        if (event.key.toLowerCase() === "c" && keyboardState.side === "output") {
          event.preventDefault();
          event.stopPropagation();
          const sourcePort = definition.outputs.find((port) => port.id === keyboardState.portId);
          if (!sourcePort) return;
          const nodeLabels = new Map(currentNodes.map((candidate) => [candidate.id, candidate.data.label]));
          const candidates: PortCandidate[] = [];
          for (const targetNode of currentNodes) {
            if (targetNode.id === keyboardState.nodeId || !targetNode.type) continue;
            const targetDefinition = getNodeType(targetNode.type);
            if (!targetDefinition) continue;
            const wouldCycle =
              findCycle(currentEdges, { source: keyboardState.nodeId, target: targetNode.id }, nodeLabels) !== null;
            if (wouldCycle) continue;
            for (const inputPort of targetDefinition.inputs) {
              if (arePortTypesCompatible(sourcePort.type, inputPort.type)) {
                candidates.push({ nodeId: targetNode.id, portId: inputPort.id });
              }
            }
          }
          candidates.sort((a, b) => {
            const nodeA = currentNodes.find((candidate) => candidate.id === a.nodeId);
            const nodeB = currentNodes.find((candidate) => candidate.id === b.nodeId);
            const ay = nodeA?.position.y ?? 0;
            const by = nodeB?.position.y ?? 0;
            if (ay !== by) return ay - by;
            return (nodeA?.position.x ?? 0) - (nodeB?.position.x ?? 0);
          });
          setKeyboardConnectionState({
            phase: "connecting",
            nodeId: keyboardState.nodeId,
            portId: keyboardState.portId,
            portType: sourcePort.type,
            candidates,
            activeIndex: 0,
          });
        }
        return;
      }

      if (keyboardState.phase === "connecting") {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setKeyboardConnectionState({
            phase: "port-focus",
            nodeId: keyboardState.nodeId,
            side: "output",
            portId: keyboardState.portId,
          });
          return;
        }

        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          if (keyboardState.candidates.length === 0) return;
          const delta = event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1;
          const nextIndex = (keyboardState.activeIndex + delta + keyboardState.candidates.length) % keyboardState.candidates.length;
          setKeyboardConnectionState({ ...keyboardState, activeIndex: nextIndex });
          return;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          const candidate = keyboardState.candidates[keyboardState.activeIndex];
          if (candidate) {
            handleConnect({
              source: keyboardState.nodeId,
              sourceHandle: keyboardState.portId,
              target: candidate.nodeId,
              targetHandle: candidate.portId,
            });
          }
          resetKeyboardConnection();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDownCapture, true);
    return () => document.removeEventListener("keydown", handleKeyDownCapture, true);
  }, [handleConnect]);

  return (
    <div className="relative size-full" onDrop={handleDrop} onDragOver={handleDragOver}>
      <CanvasContextMenu contextNodeId={contextNodeId}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          isValidConnection={handleIsValidConnection}
          onNodeContextMenu={(_event, node) => setContextNodeId(node.id)}
          onPaneContextMenu={() => setContextNodeId(null)}
          onSelectionStart={handleSelectionStart}
          onSelectionEnd={handleSelectionEnd}
          onSelectionChange={handleSelectionChange}
          onMove={handleMove}
          onMoveStart={handleMoveStart}
          onMoveEnd={handleMoveEnd}
          selectionMode={SelectionMode.Full}
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
          <NodeLibraryPanel />
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
