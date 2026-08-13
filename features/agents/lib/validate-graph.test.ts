import { describe, expect, it } from "vitest";
import { validateGraph, type ValidatableEdge, type ValidatableNode } from "./validate-graph";

function trigger(id = "trigger-1"): ValidatableNode {
  return { id, type: "trigger", data: { label: "Trigger", config: { triggerType: "manual", schedule: "" } } };
}
function llm(id = "llm-1", systemPrompt = "Do something useful."): ValidatableNode {
  return {
    id,
    type: "llm",
    data: { label: "LLM", config: { model: "llama-3.3-70b-versatile", systemPrompt, temperature: 0.7 } },
  };
}
function output(id = "output-1"): ValidatableNode {
  return { id, type: "output", data: { label: "Output", config: { destination: "somewhere" } } };
}

describe("validateGraph", () => {
  it("flags an empty graph", () => {
    const issues = validateGraph([], []);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.nodeId).toBeNull();
  });

  it("passes a real, valid, connected graph with zero issues", () => {
    const nodes = [trigger(), llm(), output()];
    const edges: ValidatableEdge[] = [
      { source: "trigger-1", target: "llm-1" },
      { source: "llm-1", target: "output-1" },
    ];
    expect(validateGraph(nodes, edges)).toEqual([]);
  });

  it("flags a graph with no enabled trigger", () => {
    const nodes = [llm(), output()];
    const issues = validateGraph(nodes, []);
    expect(issues.some((issue) => issue.message.includes("trigger"))).toBe(true);
  });

  it("does not count a disabled trigger as satisfying the requirement", () => {
    const disabledTrigger: ValidatableNode = { ...trigger(), data: { ...trigger().data, disabled: true } };
    const issues = validateGraph([disabledTrigger, llm()], []);
    expect(issues.some((issue) => issue.message.includes("trigger"))).toBe(true);
  });

  it("flags a node whose config fails its own schema, with the node's id attached", () => {
    // model is not a valid enum member -- configSchema.safeParse fails.
    const badLlm = llm("llm-1");
    badLlm.data.config.model = "not-a-real-model";
    const issues = validateGraph([trigger(), badLlm], []);
    const nodeIssue = issues.find((issue) => issue.nodeId === "llm-1");
    expect(nodeIssue).toBeDefined();
  });

  it("flags an unknown node type", () => {
    const unknown: ValidatableNode = { id: "x", type: "not-a-real-type", data: { label: "Mystery", config: {} } };
    const issues = validateGraph([trigger(), unknown], []);
    expect(issues.some((issue) => issue.nodeId === "x")).toBe(true);
  });

  it("flags a cycle even though every individual node's config is valid", () => {
    const nodes = [trigger(), llm("llm-1"), llm("llm-2")];
    const edges: ValidatableEdge[] = [
      { source: "trigger-1", target: "llm-1" },
      { source: "llm-1", target: "llm-2" },
      { source: "llm-2", target: "llm-1" },
    ];
    const issues = validateGraph(nodes, edges);
    expect(issues.some((issue) => issue.message.includes("cycle"))).toBe(true);
  });
});
