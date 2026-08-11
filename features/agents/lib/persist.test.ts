import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGraphStore } from "../store/graph-store";
import { useCanvasStore } from "../store/canvas-store";
import { useAutosave } from "./persist";

const NODE = {
  id: "node-1",
  type: "trigger",
  position: { x: 0, y: 0 },
  data: { label: "Trigger", config: {} },
};

/**
 * Gate item 2's second half: "killing the network shows an error state
 * with a retry, not a silent failure." Drives useAutosave directly via
 * renderHook (no component/DOM needed) rather than through the Inspector's
 * full render tree, and controls `fetch` directly instead of routing
 * through a real or Storybook-mocked network call.
 */
describe("useAutosave", () => {
  beforeEach(() => {
    useGraphStore.setState({ nodes: [], edges: [] });
    useCanvasStore.setState({ viewport: { x: 0, y: 0, zoom: 1 } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reaches the error state on a failed save, and retry() can recover to saved", async () => {
    let shouldFail = true;
    const fetchMock = vi.fn(async () => {
      if (shouldFail) throw new Error("network down");
      return new Response(JSON.stringify({ updatedAt: new Date().toISOString() }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAutosave("agent-1", "workspace-1"));
    expect(result.current.status).toBe("saved");

    act(() => {
      useGraphStore.getState().addNode(NODE);
    });

    await waitFor(() => expect(result.current.status).toBe("unsaved"), { timeout: 200 });
    await waitFor(() => expect(result.current.status).toBe("error"), { timeout: 2000 });

    shouldFail = false;
    act(() => {
      result.current.retry();
    });

    await waitFor(() => expect(result.current.status).toBe("saved"), { timeout: 2000 });
    expect(result.current.lastSavedAt).not.toBeNull();
  });

  it("a non-ok response is also treated as a failure, not a silent success", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "nope" }), { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAutosave("agent-1", "workspace-1"));

    act(() => {
      useGraphStore.getState().addNode(NODE);
    });

    await waitFor(() => expect(result.current.status).toBe("error"), { timeout: 2000 });
  });
});
