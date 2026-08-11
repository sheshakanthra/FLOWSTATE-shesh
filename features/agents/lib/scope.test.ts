import { describe, expect, it } from "vitest";
// Importing the registry (even just for its side effect) registers every
// real, shipped node type -- resolveUpstreamScope looks types up by id via
// getNodeType, so these tests exercise it against real port definitions
// (trigger's `out` signal, knowledge's `results` document, etc.) rather than
// a hand-rolled stand-in registry.
import "../nodes/registry";
import { resolveUpstreamScope, type ScopeGraphEdge, type ScopeGraphNode } from "./scope";

function node(id: string, type: string, label: string): ScopeGraphNode {
  return { id, type, data: { label } };
}

describe("resolveUpstreamScope", () => {
  it("offers only the outputs of nodes reachable by walking upstream, not downstream or unconnected nodes", () => {
    // trigger -> knowledge -> llm -> output, plus an unconnected condition
    // node that shares no edge with anything.
    const nodes: ScopeGraphNode[] = [
      node("a", "trigger", "Trigger"),
      node("b", "knowledge", "Knowledge"),
      node("c", "llm", "LLM"),
      node("d", "output", "Output"),
      node("e", "condition", "Stray Condition"),
    ];
    const edges: ScopeGraphEdge[] = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
      { source: "c", target: "d" },
    ];

    const scope = resolveUpstreamScope("c", nodes, edges);

    expect(scope.map((variable) => variable.nodeId).sort()).toEqual(["a", "b"]);
    expect(scope.some((variable) => variable.token === "trigger.out")).toBe(true);
    expect(scope.some((variable) => variable.token === "knowledge.results")).toBe(true);
    // Nothing from the downstream Output node or the unconnected Condition.
    expect(scope.some((variable) => variable.nodeId === "d")).toBe(false);
    expect(scope.some((variable) => variable.nodeId === "e")).toBe(false);
  });

  it("walks transitively through a three-node upstream chain, matching the gate's own example shape", () => {
    // A diamond: trigger -> (knowledge, tool) -> llm. From llm's
    // perspective there are three upstream nodes (trigger, knowledge, tool).
    const nodes: ScopeGraphNode[] = [
      node("trigger-1", "trigger", "Trigger"),
      node("knowledge-1", "knowledge", "Knowledge"),
      node("tool-1", "tool", "Tool"),
      node("llm-1", "llm", "LLM"),
    ];
    const edges: ScopeGraphEdge[] = [
      { source: "trigger-1", target: "knowledge-1" },
      { source: "trigger-1", target: "tool-1" },
      { source: "knowledge-1", target: "llm-1" },
      { source: "tool-1", target: "llm-1" },
    ];

    const scope = resolveUpstreamScope("llm-1", nodes, edges);

    expect(new Set(scope.map((variable) => variable.nodeId))).toEqual(new Set(["trigger-1", "knowledge-1", "tool-1"]));
  });

  it("returns nothing for a node with no upstream connections", () => {
    const nodes: ScopeGraphNode[] = [node("a", "trigger", "Trigger")];
    expect(resolveUpstreamScope("a", nodes, [])).toEqual([]);
  });

  it("de-duplicates a shared token by suffixing when two upstream nodes have the same label", () => {
    const nodes: ScopeGraphNode[] = [
      node("a", "knowledge", "Docs"),
      node("b", "knowledge", "Docs"),
      node("c", "llm", "LLM"),
    ];
    const edges: ScopeGraphEdge[] = [
      { source: "a", target: "c" },
      { source: "b", target: "c" },
    ];

    const scope = resolveUpstreamScope("c", nodes, edges);
    const tokens = scope.map((variable) => variable.token);
    expect(new Set(tokens).size).toBe(tokens.length);
    expect(tokens).toContain("docs.results");
    expect(tokens.some((token) => token.startsWith("docs_2."))).toBe(true);
  });

  it("doesn't loop forever if the graph somehow contains a cycle", () => {
    const nodes: ScopeGraphNode[] = [node("a", "llm", "LLM"), node("b", "llm", "LLM 2")];
    const edges: ScopeGraphEdge[] = [
      { source: "a", target: "b" },
      { source: "b", target: "a" },
    ];
    expect(() => resolveUpstreamScope("a", nodes, edges)).not.toThrow();
  });
});
