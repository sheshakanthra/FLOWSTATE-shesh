"use client";

import * as React from "react";
import type { Viewport } from "@xyflow/react";
import { finish, start } from "@/components/firing-bar";
import { useCanvasStore } from "../store/canvas-store";
import { useGraphStore, type CanvasEdge, type CanvasNode } from "../store/graph-store";

export type SaveStatus = "unsaved" | "saving" | "saved" | "error";

const AUTOSAVE_DEBOUNCE_MS = 800;

/** The wire shape written to `agents.graph_jsonb` -- strips `selected`
 *  (ephemeral UI state React Flow puts on every node/edge) since it has no
 *  business surviving a reload, and would otherwise make every reload land
 *  with the last session's selection still highlighted. */
export interface SerializedGraph {
  nodes: Omit<CanvasNode, "selected">[];
  edges: Omit<CanvasEdge, "selected">[];
}

function omitSelected<T extends { selected?: boolean }>(item: T): Omit<T, "selected"> {
  const clone: Partial<T> = { ...item };
  delete clone.selected;
  return clone as Omit<T, "selected">;
}

export function serializeGraph(nodes: CanvasNode[], edges: CanvasEdge[]): SerializedGraph {
  return {
    nodes: nodes.map(omitSelected),
    edges: edges.map(omitSelected),
  };
}

async function putAgentGraph(
  agentId: string,
  workspaceSlug: string,
  graph: SerializedGraph,
  viewport: Viewport,
): Promise<void> {
  const response = await fetch(`/api/agents/${agentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceSlug, graph, viewport }),
  });
  if (!response.ok) {
    throw new Error(`Save failed with status ${response.status}`);
  }
}

export interface UseAutosaveResult {
  status: SaveStatus;
  lastSavedAt: number | null;
  retry: () => void;
}

/**
 * Debounced (800ms) autosave of the live graph + viewport to
 * `agents.graph_jsonb` -- gate item 1 ("persists within 1.5s") and item 2
 * (the three-state save indicator, with a retry on failure). Mount exactly
 * once per agent-builder page (see features/agents/builder.tsx); subscribes
 * directly to both stores rather than being handed nodes/edges/viewport as
 * props, so it fires on every structural graph change *and* every viewport
 * settle without the caller needing to know that.
 *
 * The initial mount (right after hydrating the stores from the server's
 * already-saved graph) is deliberately not itself a save trigger --
 * `hydratedRef` skips the first change notification so opening an agent
 * doesn't immediately flip the indicator to "saving" for a no-op write.
 */
export function useAutosave(agentId: string, workspaceSlug: string): UseAutosaveResult {
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const viewport = useCanvasStore((state) => state.viewport);

  const [status, setStatus] = React.useState<SaveStatus>("saved");
  const [lastSavedAt, setLastSavedAt] = React.useState<number | null>(null);

  const hydratedRef = React.useRef(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const firingIdRef = React.useRef<string | null>(null);

  const runSave = React.useCallback(async () => {
    setStatus("saving");
    firingIdRef.current = start({ label: "Saving agent…", initiator: "agent-inspector" });
    try {
      const state = useGraphStore.getState();
      const currentViewport = useCanvasStore.getState().viewport;
      await putAgentGraph(agentId, workspaceSlug, serializeGraph(state.nodes, state.edges), currentViewport);
      finish(firingIdRef.current, "success");
      setStatus("saved");
      setLastSavedAt(Date.now());
    } catch {
      if (firingIdRef.current) finish(firingIdRef.current, "error");
      setStatus("error");
    } finally {
      firingIdRef.current = null;
    }
  }, [agentId, workspaceSlug]);

  React.useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    setStatus("unsaved");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSave();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [nodes, edges, viewport, runSave]);

  const retry = React.useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    void runSave();
  }, [runSave]);

  return { status, lastSavedAt, retry };
}
