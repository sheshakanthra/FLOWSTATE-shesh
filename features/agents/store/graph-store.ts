"use client";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { applyEdgeChanges, applyNodeChanges, type Edge, type EdgeChange, type NodeChange } from "@xyflow/react";
import type { AgentNode } from "../nodes/registry";

export type CanvasNode = AgentNode;
export type CanvasEdge = Edge;

interface GraphState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];

  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<CanvasEdge>[]) => void;

  addNode: (node: CanvasNode) => void;
  addNodes: (nodes: CanvasNode[]) => void;
  addEdges: (edges: CanvasEdge[]) => void;
  setGraph: (nodes: CanvasNode[], edges: CanvasEdge[]) => void;

  /** Replaces the full selected-id set. Additive (shift-drag) semantics are
   *  computed by the caller (features/agents/canvas/index.tsx) -- this store
   *  only ever applies a final, already-resolved set. */
  setSelection: (nodeIds: string[], edgeIds: string[]) => void;

  /** Flips a single node's `disabled` visual state -- the only per-node data
   *  mutation this session ships a UI affordance for (the node context
   *  menu's "Disable/Enable node"), since config editing itself is B3's job. */
  toggleNodeDisabled: (nodeId: string) => void;

  /**
   * B3's node-editing surface. Every action below is a plain mutator with no
   * undo baked in -- callers (canvas/index.tsx, context-menu.tsx,
   * library/index.tsx, the Inspector) register the inverse themselves via
   * features/agents/lib/graph-undo.ts, since only the caller knows whether a
   * given change is a single-shot op (one registerGraphUndo call) or part of
   * a keystroke/drag burst that needs coalescing into one undo step.
   */
  setNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  setNodeLabel: (nodeId: string, label: string) => void;
  setNodeConfigValues: (entries: { nodeId: string; key: string; value: unknown }[]) => void;
  /** Removes the given nodes and every edge touching any of them, returning
   *  exactly what was removed so the caller can build an undo entry that
   *  restores both together via `restoreFragment`. */
  removeNodesWithEdges: (nodeIds: string[]) => { removedNodes: CanvasNode[]; removedEdges: CanvasEdge[] };
  removeEdgesByIds: (edgeIds: string[]) => CanvasEdge[];
  /** Re-inserts a previously-removed nodes/edges fragment verbatim (same
   *  ids/positions/data) -- the undo half of removeNodesWithEdges /
   *  removeEdgesByIds, and the redo half of add/paste/duplicate. */
  restoreFragment: (nodes: CanvasNode[], edges: CanvasEdge[]) => void;
}

/**
 * Holds nodes and edges only -- viewport, selection-in-progress, and
 * interaction mode live in useCanvasStore instead. Panning writes to that
 * store exclusively (via the vanilla API, not a hook subscription in the
 * canvas component itself), so it never touches this store's subscriber
 * list and can't trigger a node re-render. See canvas-store.ts and
 * PROGRESS.md's B1 decisions for why the split is physical, not just a
 * matter of selector discipline.
 */
export const useGraphStore = create<GraphState>()(
  immer((set, get) => ({
    nodes: [],
    edges: [],

    /**
     * Drops `select`-type changes. React Flow's own box-select always resets
     * the selection at drag start, with no additive mode -- selection is
     * instead owned end-to-end by setSelection, driven by the canvas's
     * onSelectionStart/onSelectionChange handlers, so the two mechanisms
     * never fight each other.
     */
    onNodesChange: (changes) =>
      set((state) => {
        const structural = changes.filter((change) => change.type !== "select");
        state.nodes = applyNodeChanges(structural, state.nodes);
      }),
    onEdgesChange: (changes) =>
      set((state) => {
        const structural = changes.filter((change) => change.type !== "select");
        state.edges = applyEdgeChanges(structural, state.edges);
      }),

    addNode: (node) =>
      set((state) => {
        state.nodes.push(node);
      }),
    addNodes: (nodes) =>
      set((state) => {
        state.nodes.push(...nodes);
      }),
    addEdges: (edges) =>
      set((state) => {
        state.edges.push(...edges);
      }),
    setGraph: (nodes, edges) =>
      set((state) => {
        state.nodes = nodes;
        state.edges = edges;
      }),

    /**
     * Rebuilds every node/edge object rather than mutating `.selected` in
     * place, even for entries whose value doesn't change. React Flow resets
     * its own internal "is this node selected" bookkeeping the instant a new
     * box-select drag starts (see canvas/index.tsx's decision comment on the
     * additive shift-drag override) -- that reset never reaches this store
     * (onNodesChange drops `select`-type changes), but it does mean React
     * Flow's internal copy briefly disagrees with ours. If a node's
     * `selected` value happens to be unchanged from before (e.g. it was
     * already selected and a second, additive box-select re-confirms that),
     * immer's structural sharing would keep the exact same object reference
     * for it -- and React Flow, seeing a reference-identical node object,
     * has nothing to prompt it to re-sync from our (correct) value over its
     * own (stale, reset-to-false) internal one. A fresh object reference on
     * every call forces that re-sync unconditionally. Found by tracing a
     * real failure: the store's own `selected` flags were verified correct
     * after an additive drag, but the rendered `.selected` CSS class on an
     * already-selected node silently didn't update.
     */
    setSelection: (nodeIds, edgeIds) =>
      set((state) => {
        const nodeIdSet = new Set(nodeIds);
        const edgeIdSet = new Set(edgeIds);
        state.nodes = state.nodes.map((node) => ({ ...node, selected: nodeIdSet.has(node.id) }));
        state.edges = state.edges.map((edge) => ({ ...edge, selected: edgeIdSet.has(edge.id) }));
      }),

    toggleNodeDisabled: (nodeId) =>
      set((state) => {
        const node = state.nodes.find((candidate) => candidate.id === nodeId);
        if (node) node.data.disabled = !node.data.disabled;
      }),

    setNodePosition: (nodeId, position) =>
      set((state) => {
        const node = state.nodes.find((candidate) => candidate.id === nodeId);
        if (node) node.position = position;
      }),

    setNodeLabel: (nodeId, label) =>
      set((state) => {
        const node = state.nodes.find((candidate) => candidate.id === nodeId);
        if (node) node.data.label = label;
      }),

    setNodeConfigValues: (entries) =>
      set((state) => {
        for (const entry of entries) {
          const node = state.nodes.find((candidate) => candidate.id === entry.nodeId);
          if (node) node.data.config[entry.key] = entry.value;
        }
      }),

    removeNodesWithEdges: (nodeIds) => {
      const idSet = new Set(nodeIds);
      const { nodes, edges } = get();
      const removedNodes = nodes.filter((node) => idSet.has(node.id));
      const removedEdges = edges.filter((edge) => idSet.has(edge.source) || idSet.has(edge.target));
      const removedEdgeIds = new Set(removedEdges.map((edge) => edge.id));
      set((state) => {
        state.nodes = state.nodes.filter((node) => !idSet.has(node.id));
        state.edges = state.edges.filter((edge) => !removedEdgeIds.has(edge.id));
      });
      return { removedNodes, removedEdges };
    },

    removeEdgesByIds: (edgeIds) => {
      const idSet = new Set(edgeIds);
      const removedEdges = get().edges.filter((edge) => idSet.has(edge.id));
      set((state) => {
        state.edges = state.edges.filter((edge) => !idSet.has(edge.id));
      });
      return removedEdges;
    },

    restoreFragment: (nodes, edges) =>
      set((state) => {
        state.nodes.push(...nodes);
        state.edges.push(...edges);
      }),
  })),
);
