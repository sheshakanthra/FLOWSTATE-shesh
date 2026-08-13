import { describe, expect, it } from "vitest";
import { diffGraphs, type DiffableGraph } from "./diff";

function node(id: string, label: string, config: Record<string, unknown> = {}): DiffableGraph["nodes"][number] {
  return { id, type: "llm", position: { x: 0, y: 0 }, data: { label, config } };
}

describe("diffGraphs -- gate item 3", () => {
  it("marks a node present only in the current draft as added", () => {
    const base: DiffableGraph = { nodes: [node("a", "A")], edges: [] };
    const compare: DiffableGraph = { nodes: [node("a", "A"), node("b", "B")], edges: [] };
    const entries = diffGraphs(base, compare);
    expect(entries.find((e) => e.nodeId === "b")!.status).toBe("added");
  });

  it("marks a node present only in the historical version as removed", () => {
    const base: DiffableGraph = { nodes: [node("a", "A"), node("b", "B")], edges: [] };
    const compare: DiffableGraph = { nodes: [node("a", "A")], edges: [] };
    const entries = diffGraphs(base, compare);
    expect(entries.find((e) => e.nodeId === "b")!.status).toBe("removed");
  });

  it("marks a node with a changed config value as modified, listing the changed field", () => {
    const base: DiffableGraph = { nodes: [node("a", "A", { systemPrompt: "old" })], edges: [] };
    const compare: DiffableGraph = { nodes: [node("a", "A", { systemPrompt: "new" })], edges: [] };
    const entries = diffGraphs(base, compare);
    const entry = entries.find((e) => e.nodeId === "a")!;
    expect(entry.status).toBe("modified");
    expect(entry.changes).toEqual([{ field: "systemPrompt", before: "old", after: "new" }]);
  });

  it("marks a node with a changed label as modified", () => {
    const base: DiffableGraph = { nodes: [node("a", "Old Name")], edges: [] };
    const compare: DiffableGraph = { nodes: [node("a", "New Name")], edges: [] };
    const entries = diffGraphs(base, compare);
    expect(entries.find((e) => e.nodeId === "a")!.status).toBe("modified");
  });

  it("marks an identical node as unchanged, with no listed changes", () => {
    const base: DiffableGraph = { nodes: [node("a", "A", { x: 1 })], edges: [] };
    const compare: DiffableGraph = { nodes: [node("a", "A", { x: 1 })], edges: [] };
    const entries = diffGraphs(base, compare);
    const entry = entries.find((e) => e.nodeId === "a")!;
    expect(entry.status).toBe("unchanged");
    expect(entry.changes).toEqual([]);
  });

  it("handles multiple simultaneous changes across a whole graph correctly", () => {
    const base: DiffableGraph = {
      nodes: [node("keep", "Keep"), node("change", "Change", { v: 1 }), node("gone", "Gone")],
      edges: [],
    };
    const compare: DiffableGraph = {
      nodes: [node("keep", "Keep"), node("change", "Change", { v: 2 }), node("new", "New")],
      edges: [],
    };
    const entries = diffGraphs(base, compare);
    const byId = new Map(entries.map((e) => [e.nodeId, e.status]));
    expect(byId.get("keep")).toBe("unchanged");
    expect(byId.get("change")).toBe("modified");
    expect(byId.get("gone")).toBe("removed");
    expect(byId.get("new")).toBe("added");
  });
});
