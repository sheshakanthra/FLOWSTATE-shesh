"use client";

import { create } from "zustand";

/**
 * The hero's own per-node run-status store -- deliberately not a reuse of
 * `features/agents/store/run-store.ts`. That store is a module-level
 * singleton shared by the whole authenticated product; Next's App Router
 * keeps client module state alive across client-side navigations, so a
 * visitor who runs the marketing demo and then clicks through to sign up
 * would carry stale "succeeded"/"failed" node statuses from the demo straight
 * into the real product's canvas the moment its NodeShell first reads that
 * same store. A separate, feature-owned store (mirroring B5's replay-store
 * precedent for the same reason -- see PROGRESS.md) makes that leak
 * structurally impossible instead of relying on remembering to reset it.
 */
export type DemoNodeStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";

interface DemoRunState {
  nodeStatuses: Record<string, DemoNodeStatus>;
  setNodeStatus: (nodeId: string, status: DemoNodeStatus) => void;
  reset: () => void;
}

export const useDemoRunStore = create<DemoRunState>((set) => ({
  nodeStatuses: {},
  setNodeStatus: (nodeId, status) =>
    set((state) => ({ nodeStatuses: { ...state.nodeStatuses, [nodeId]: status } })),
  reset: () => set({ nodeStatuses: {} }),
}));
