"use client";

import { create } from "zustand";

/**
 * Live per-node execution state for the current test-console run --
 * physically separate from graph-store/canvas-store for the same reason
 * B1 split those two (see PROGRESS.md): this updates once per step
 * start/end (and, for a running LLM node, isn't touched at token
 * frequency at all -- token text lives in the console's own step-log
 * state, not here), so nothing here needs to be fast, but nothing here
 * should cause the *graph* to re-render either.
 *
 * `nodeStatuses` is intentionally the only thing a node/edge needs to
 * derive its own run-feedback styling: an outgoing edge's "traveling
 * pulse" (session spec item 5) isn't its own tracked field -- the edge
 * component just reads whether its own `source` node's status is
 * `"running"`, so there's exactly one place a node's run state lives.
 */
export type NodeRunStatus = "running" | "succeeded" | "failed" | "skipped";

interface RunState {
  runId: string | null;
  isRunning: boolean;
  nodeStatuses: Record<string, NodeRunStatus>;

  startRun: (runId: string) => void;
  setNodeStatus: (nodeId: string, status: NodeRunStatus) => void;
  endRun: () => void;
  reset: () => void;
}

export const useRunStore = create<RunState>((set) => ({
  runId: null,
  isRunning: false,
  nodeStatuses: {},

  startRun: (runId) => set({ runId, isRunning: true, nodeStatuses: {} }),
  setNodeStatus: (nodeId, status) =>
    set((state) => ({ nodeStatuses: { ...state.nodeStatuses, [nodeId]: status } })),
  endRun: () => set({ isRunning: false }),
  reset: () => set({ runId: null, isRunning: false, nodeStatuses: {} }),
}));
