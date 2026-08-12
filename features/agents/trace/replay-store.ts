"use client";

import { create } from "zustand";
import { deriveActiveEdgeIds, deriveNodeStatesAtTime, type NodeReplayStatus, type NormalizedEdge, type NormalizedStep } from "./playhead";

export type PlaybackSpeed = 0.5 | 1 | 2 | 4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function deriveAt(steps: NormalizedStep[], edges: NormalizedEdge[], playheadMs: number) {
  return {
    nodeStates: Object.fromEntries(deriveNodeStatesAtTime(steps, playheadMs)) as Record<string, NodeReplayStatus>,
    activeEdgeIds: deriveActiveEdgeIds(edges, steps, playheadMs),
  };
}

interface ReplayState {
  runId: string | null;
  steps: NormalizedStep[];
  edges: NormalizedEdge[];
  runDurationMs: number;
  finalTotalCostCents: number;
  playheadMs: number;
  isPlaying: boolean;
  speed: PlaybackSpeed;
  selectedNodeId: string | null;

  /**
   * A pure, wholesale recomputation of `(steps, playheadMs)` -- never
   * patched incrementally, always fully replaced by `deriveAt` on every
   * write. This is a cache for one reason only: so ReplayNode/ReplayEdge can
   * subscribe with a granular per-id selector (`state.nodeStates[id]`),
   * mirroring run-store.ts's live `nodeStatuses` -- without it, every node
   * would have to recompute (or re-subscribe to) the full derivation itself
   * on every one of the ~60 playhead writes a drag produces per second
   * (gate item 2), which re-renders the entire canvas every frame instead
   * of only the node whose own status actually changed. Because it's always
   * a total recomputation from the two source-of-truth values and never an
   * independent write, it cannot desync from them -- this is not the
   * "store per-node state and mutate it" anti-pattern the session spec's
   * Notes warn against; it's a cached derivation, not a second source of
   * truth.
   */
  nodeStates: Record<string, NodeReplayStatus>;
  activeEdgeIds: Set<string>;

  loadTrace: (data: {
    runId: string;
    steps: NormalizedStep[];
    edges: NormalizedEdge[];
    runDurationMs: number;
    finalTotalCostCents: number;
    initialPlayheadMs?: number;
  }) => void;
  setPlayhead: (ms: number) => void;
  play: () => void;
  pause: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
}

export const useReplayStore = create<ReplayState>((set, get) => ({
  runId: null,
  steps: [],
  edges: [],
  runDurationMs: 0,
  finalTotalCostCents: 0,
  playheadMs: 0,
  isPlaying: false,
  speed: 1,
  selectedNodeId: null,
  nodeStates: {},
  activeEdgeIds: new Set(),

  loadTrace: ({ runId, steps, edges, runDurationMs, finalTotalCostCents, initialPlayheadMs }) => {
    const playheadMs = clamp(initialPlayheadMs ?? 0, 0, runDurationMs);
    set({
      runId,
      steps,
      edges,
      runDurationMs,
      finalTotalCostCents,
      playheadMs,
      isPlaying: false,
      selectedNodeId: null,
      ...deriveAt(steps, edges, playheadMs),
    });
  },

  setPlayhead: (ms) => {
    const state = get();
    const clamped = clamp(ms, 0, state.runDurationMs);
    set({
      playheadMs: clamped,
      isPlaying: clamped >= state.runDurationMs ? false : state.isPlaying,
      ...deriveAt(state.steps, state.edges, clamped),
    });
  },

  play: () => {
    const state = get();
    const atEnd = state.playheadMs >= state.runDurationMs;
    set({
      isPlaying: true,
      playheadMs: atEnd ? 0 : state.playheadMs,
      ...(atEnd ? deriveAt(state.steps, state.edges, 0) : {}),
    });
  },

  pause: () => set({ isPlaying: false }),
  setSpeed: (speed) => set({ speed }),
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
}));
