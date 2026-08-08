import { describe, expect, it } from "vitest";
import { isTypeCompatibleConnection, validateConnection, type ValidationNode } from "./validation";

const nodes: ValidationNode[] = [
  { id: "trigger-1", type: "trigger", data: { label: "Trigger" } },
  { id: "llm-1", type: "llm", data: { label: "LLM" } },
  { id: "knowledge-1", type: "knowledge", data: { label: "Knowledge" } },
  { id: "condition-1", type: "condition", data: { label: "Condition" } },
];

describe("validateConnection", () => {
  it("accepts a compatible connection", () => {
    // trigger's "out" is a signal port, condition's "in" accepts any.
    const result = validateConnection(
      { source: "trigger-1", sourceHandle: "out", target: "condition-1", targetHandle: "in" },
      nodes,
      [],
    );
    expect(result).toEqual({ valid: true });
  });

  it("rejects text -> document as incompatible, naming both types", () => {
    // knowledge's "results" output is a document port; llm's "prompt" input is text.
    const result = validateConnection(
      { source: "knowledge-1", sourceHandle: "results", target: "llm-1", targetHandle: "prompt" },
      nodes,
      [],
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("document");
      expect(result.reason).toContain("text");
    }
  });

  it("rejects a connection that would create a cycle, naming the full cycle", () => {
    const cycleNodes: ValidationNode[] = [
      { id: "a", type: "condition", data: { label: "Start" } },
      { id: "b", type: "condition", data: { label: "Middle" } },
    ];
    const edges = [{ source: "a", target: "b" }];
    // b -> a: b's "true" output (signal) into a's "in" input (any) -- type
    // compatible, and closes a cycle since a already reaches b.
    const result = validateConnection({ source: "b", sourceHandle: "true", target: "a", targetHandle: "in" }, cycleNodes, edges);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("cycle");
      expect(result.reason).toContain("Start");
      expect(result.reason).toContain("Middle");
    }
  });

  it("rejects a self-loop", () => {
    const result = validateConnection(
      { source: "condition-1", sourceHandle: "true", target: "condition-1", targetHandle: "in" },
      nodes,
      [],
    );
    expect(result).toEqual({ valid: false, reason: "A node can't connect to itself." });
  });

  it("rejects a connection missing an endpoint", () => {
    const result = validateConnection({ source: "trigger-1", sourceHandle: "out", target: null, targetHandle: null }, nodes, []);
    expect(result.valid).toBe(false);
  });
});

describe("isTypeCompatibleConnection", () => {
  it("mirrors validateConnection's type check without needing the edge list", () => {
    expect(
      isTypeCompatibleConnection(
        { source: "trigger-1", sourceHandle: "out", target: "condition-1", targetHandle: "in" },
        nodes,
      ),
    ).toBe(true);
    expect(
      isTypeCompatibleConnection(
        { source: "knowledge-1", sourceHandle: "results", target: "llm-1", targetHandle: "prompt" },
        nodes,
      ),
    ).toBe(false);
  });
});
