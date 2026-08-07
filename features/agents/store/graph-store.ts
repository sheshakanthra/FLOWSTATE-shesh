"use client";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { applyEdgeChanges, applyNodeChanges, type Edge, type EdgeChange, type NodeChange } from "@xyflow/react";
import type { GenericNodeType } from "../nodes/generic-node";

export type CanvasNode = GenericNodeType;
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
  immer((set) => ({
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

    setSelection: (nodeIds, edgeIds) =>
      set((state) => {
        const nodeIdSet = new Set(nodeIds);
        const edgeIdSet = new Set(edgeIds);
        for (const node of state.nodes) node.selected = nodeIdSet.has(node.id);
        for (const edge of state.edges) edge.selected = edgeIdSet.has(edge.id);
      }),
  })),
);
