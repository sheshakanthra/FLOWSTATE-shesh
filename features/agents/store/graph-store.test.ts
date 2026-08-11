import { beforeEach, describe, expect, it } from "vitest";
import { useGraphStore, type CanvasEdge, type CanvasNode } from "./graph-store";

function node(id: string, config: Record<string, unknown> = {}): CanvasNode {
  return { id, type: "trigger", position: { x: 0, y: 0 }, data: { label: id, config } };
}

function edge(id: string, source: string, target: string): CanvasEdge {
  return { id, source, target };
}

beforeEach(() => {
  useGraphStore.setState({ nodes: [], edges: [] });
});

describe("graph-store: B3 mutation actions", () => {
  it("setNodePosition updates only the targeted node", () => {
    useGraphStore.getState().setGraph([node("a"), node("b")], []);
    useGraphStore.getState().setNodePosition("a", { x: 100, y: 200 });
    const nodes = useGraphStore.getState().nodes;
    expect(nodes.find((n) => n.id === "a")?.position).toEqual({ x: 100, y: 200 });
    expect(nodes.find((n) => n.id === "b")?.position).toEqual({ x: 0, y: 0 });
  });

  it("setNodeLabel updates only the targeted node's label", () => {
    useGraphStore.getState().setGraph([node("a")], []);
    useGraphStore.getState().setNodeLabel("a", "Renamed");
    expect(useGraphStore.getState().nodes[0]?.data.label).toBe("Renamed");
  });

  it("setNodeConfigValues applies per-node, per-key entries in one call (multi-select shared edit)", () => {
    useGraphStore.getState().setGraph([node("a", { model: "x" }), node("b", { model: "y" })], []);
    useGraphStore.getState().setNodeConfigValues([
      { nodeId: "a", key: "model", value: "shared" },
      { nodeId: "b", key: "model", value: "shared" },
    ]);
    const nodes = useGraphStore.getState().nodes;
    expect(nodes.find((n) => n.id === "a")?.data.config.model).toBe("shared");
    expect(nodes.find((n) => n.id === "b")?.data.config.model).toBe("shared");
  });

  it("setNodeConfigValues can restore differing per-node values (multi-select undo)", () => {
    useGraphStore.getState().setGraph([node("a", { model: "x" }), node("b", { model: "y" })], []);
    useGraphStore.getState().setNodeConfigValues([
      { nodeId: "a", key: "model", value: "x" },
      { nodeId: "b", key: "model", value: "y" },
    ]);
    const nodes = useGraphStore.getState().nodes;
    expect(nodes.find((n) => n.id === "a")?.data.config.model).toBe("x");
    expect(nodes.find((n) => n.id === "b")?.data.config.model).toBe("y");
  });

  it("removeNodesWithEdges removes the nodes and every edge touching them, and returns what it removed", () => {
    useGraphStore.getState().setGraph(
      [node("a"), node("b"), node("c")],
      [edge("e1", "a", "b"), edge("e2", "b", "c")],
    );
    const { removedNodes, removedEdges } = useGraphStore.getState().removeNodesWithEdges(["b"]);

    expect(removedNodes.map((n) => n.id)).toEqual(["b"]);
    expect(removedEdges.map((e) => e.id).sort()).toEqual(["e1", "e2"]);

    const state = useGraphStore.getState();
    expect(state.nodes.map((n) => n.id).sort()).toEqual(["a", "c"]);
    expect(state.edges).toEqual([]);
  });

  it("removeEdgesByIds removes only the given edges, leaving nodes untouched", () => {
    useGraphStore.getState().setGraph([node("a"), node("b")], [edge("e1", "a", "b")]);
    const removed = useGraphStore.getState().removeEdgesByIds(["e1"]);
    expect(removed.map((e) => e.id)).toEqual(["e1"]);
    expect(useGraphStore.getState().edges).toEqual([]);
    expect(useGraphStore.getState().nodes).toHaveLength(2);
  });

  it("restoreFragment re-inserts a previously removed nodes/edges fragment verbatim", () => {
    useGraphStore.getState().setGraph([node("a"), node("b")], [edge("e1", "a", "b")]);
    const { removedNodes, removedEdges } = useGraphStore.getState().removeNodesWithEdges(["b"]);
    expect(useGraphStore.getState().nodes).toHaveLength(1);

    useGraphStore.getState().restoreFragment(removedNodes, removedEdges);

    const state = useGraphStore.getState();
    expect(state.nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
    expect(state.edges.map((e) => e.id)).toEqual(["e1"]);
  });
});
