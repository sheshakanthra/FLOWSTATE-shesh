"use client";

import { create } from "zustand";
import type { Viewport } from "@xyflow/react";
import type { CanvasNode } from "./graph-store";

export type InteractionMode = "idle" | "panning" | "selecting";

interface CanvasState {
  viewport: Viewport;
  /** Mirror of the current node selection, for UI that shouldn't have to
   *  subscribe to useGraphStore's node array just to know what's selected
   *  (future inspector, B5's trace scrubber). Source of truth for what's
   *  actually rendered as selected is still each node's own `selected`
   *  field in useGraphStore -- this is a read mirror, kept in sync by
   *  features/agents/canvas/index.tsx's onSelectionChange handler. */
  selectedNodeIds: string[];
  interactionMode: InteractionMode;
  /** In-memory only, per this session's "no persistence beyond in-memory"
   *  scope -- not the OS clipboard. */
  clipboard: CanvasNode[] | null;

  setViewport: (viewport: Viewport) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  setInteractionMode: (mode: InteractionMode) => void;
  setClipboard: (nodes: CanvasNode[] | null) => void;
}

/**
 * Viewport transform, selection mirror, interaction mode, and the in-memory
 * node clipboard -- everything that changes at pan/zoom/drag frequency, or
 * that other UI needs to read without subscribing to node/edge data.
 * Physically separate from useGraphStore (which holds only nodes and edges)
 * so panning's 60Hz onMove writes never touch graph-store's subscriber
 * list -- not just disciplined selectors within one store, but a store a
 * node component has no way to accidentally subscribe to. See PROGRESS.md's
 * B1 decisions.
 *
 * Every field here is a flat whole-value replace, so this store skips the
 * immer middleware graph-store uses for its array mutations -- there's
 * nothing here immer would make simpler.
 */
export const useCanvasStore = create<CanvasState>((set) => ({
  viewport: { x: 0, y: 0, zoom: 1 },
  selectedNodeIds: [],
  interactionMode: "idle",
  clipboard: null,

  setViewport: (viewport) => set({ viewport }),
  setSelectedNodeIds: (selectedNodeIds) => set({ selectedNodeIds }),
  setInteractionMode: (interactionMode) => set({ interactionMode }),
  setClipboard: (clipboard) => set({ clipboard }),
}));
