import { describe, expect, it } from "vitest";
import "../nodes/registry";
import { interpolateConfig, interpolateTemplate, resolvePortInputs, type EngineGraphEdge, type NodeOutputs } from "./scope-resolver";
import type { ScopeGraphNode } from "../lib/scope";

function node(id: string, type: string, label: string): ScopeGraphNode {
  return { id, type, data: { label } };
}

describe("interpolateTemplate", () => {
  it("replaces a {{token}} with its resolved upstream value", () => {
    const nodes = [node("a", "trigger", "Trigger"), node("b", "llm", "LLM")];
    const edges: EngineGraphEdge[] = [{ id: "e1", source: "a", target: "b" }];
    const outputs: NodeOutputs = new Map([["a", { out: "hello" }]]);

    const result = interpolateTemplate("Say: {{trigger.out}}", "b", nodes, edges, outputs);
    expect(result).toBe("Say: hello");
  });

  it("JSON-stringifies a non-string resolved value", () => {
    const nodes = [node("a", "knowledge", "Docs"), node("b", "llm", "LLM")];
    const edges: EngineGraphEdge[] = [{ id: "e1", source: "a", target: "b" }];
    const outputs: NodeOutputs = new Map([["a", { results: [{ id: 1 }] }]]);

    const result = interpolateTemplate("Context: {{docs.results}}", "b", nodes, edges, outputs);
    expect(result).toBe('Context: [{"id":1}]');
  });

  it("leaves an unmatched token as literal text rather than dropping it", () => {
    const nodes = [node("a", "llm", "LLM")];
    const result = interpolateTemplate("{{nope.here}}", "a", nodes, [], new Map());
    expect(result).toBe("{{nope.here}}");
  });

  it("leaves a token whose producing node hasn't executed yet unresolved as literal text", () => {
    const nodes = [node("a", "trigger", "Trigger"), node("b", "llm", "LLM")];
    const edges: EngineGraphEdge[] = [{ id: "e1", source: "a", target: "b" }];
    const result = interpolateTemplate("{{trigger.out}}", "b", nodes, edges, new Map());
    expect(result).toBe("");
  });
});

describe("interpolateConfig", () => {
  it("interpolates only string fields, leaving numbers/booleans untouched", () => {
    const nodes = [node("a", "trigger", "Trigger"), node("b", "llm", "LLM")];
    const edges: EngineGraphEdge[] = [{ id: "e1", source: "a", target: "b" }];
    const outputs: NodeOutputs = new Map([["a", { out: "go" }]]);

    const result = interpolateConfig({ systemPrompt: "Do: {{trigger.out}}", temperature: 0.7 }, "b", nodes, edges, outputs);
    expect(result).toEqual({ systemPrompt: "Do: go", temperature: 0.7 });
  });
});

describe("resolvePortInputs", () => {
  it("resolves each wired input port from its edge's source output", () => {
    const edges: EngineGraphEdge[] = [
      { id: "e1", source: "a", sourceHandle: "results", target: "b", targetHandle: "context" },
      { id: "e2", source: "c", sourceHandle: "response", target: "b", targetHandle: "prompt" },
    ];
    const outputs: NodeOutputs = new Map([
      ["a", { results: ["doc1"] }],
      ["c", { response: "hi" }],
    ]);

    const result = resolvePortInputs("b", edges, outputs);
    expect(result).toEqual({ context: ["doc1"], prompt: "hi" });
  });

  it("returns undefined for a port whose source hasn't produced output yet", () => {
    const edges: EngineGraphEdge[] = [{ id: "e1", source: "a", sourceHandle: "out", target: "b", targetHandle: "in" }];
    const result = resolvePortInputs("b", edges, new Map());
    expect(result).toEqual({ in: undefined });
  });

  it("ignores edges not targeting this node", () => {
    const edges: EngineGraphEdge[] = [{ id: "e1", source: "a", sourceHandle: "out", target: "z", targetHandle: "in" }];
    const result = resolvePortInputs("b", edges, new Map([["a", { out: 1 }]]));
    expect(result).toEqual({});
  });
});
