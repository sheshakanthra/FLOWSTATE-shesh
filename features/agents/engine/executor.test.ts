import { beforeEach, describe, expect, it, vi } from "vitest";
import "../nodes/registry";
import { runGraph, type EngineNode } from "./executor";
import type { EngineGraphEdge } from "./scope-resolver";

function triggerNode(id: string): EngineNode {
  return { id, type: "trigger", data: { label: id, config: { triggerType: "manual", schedule: "" } } };
}
function transformNode(id: string, expression = ""): EngineNode {
  return { id, type: "transform", data: { label: id, config: { expression } } };
}
function conditionNode(id: string, expression = ""): EngineNode {
  return { id, type: "condition", data: { label: id, config: { expression } } };
}
function outputNode(id: string): EngineNode {
  return { id, type: "output", data: { label: id, config: { destination: "" } } };
}

const signal = new AbortController().signal;

describe("runGraph: basic execution", () => {
  it("runs a linear graph in order and captures the reached Output node's input as a final output", async () => {
    const nodes = [triggerNode("t"), transformNode("x"), outputNode("o")];
    const edges: EngineGraphEdge[] = [
      { id: "e1", source: "t", target: "x", sourceHandle: "out", targetHandle: "input" },
      { id: "e2", source: "x", target: "o", sourceHandle: "output", targetHandle: "in" },
    ];

    const started: string[] = [];
    const ended: { nodeId: string; status: string }[] = [];

    const result = await runGraph({
      nodes,
      edges,
      runInput: { hello: "world" },
      signal,
      onStepStart: (event) => {
        started.push(event.nodeId);
      },
      onStepEnd: (event) => {
        ended.push({ nodeId: event.nodeId, status: event.status });
      },
    });

    expect(started).toEqual(["t", "x", "o"]);
    expect(ended.every((step) => step.status === "succeeded")).toBe(true);
    expect(result.status).toBe("succeeded");
    expect(result.finalOutputs).toEqual([{ hello: "world" }]);
  });

  it("runs an unconnected node as an independent entry point rather than skipping it", async () => {
    const nodes = [triggerNode("t"), transformNode("orphan")];
    const result = await runGraph({ nodes, edges: [], runInput: null, signal });
    expect(result.status).toBe("succeeded");
  });
});

describe("runGraph: condition branch pruning (gate item 5's skip mechanism)", () => {
  it("marks the not-taken branch's dependent as skipped, and the taken branch as succeeded", async () => {
    const nodes = [triggerNode("t"), conditionNode("c", "true"), outputNode("true-branch"), outputNode("false-branch")];
    const edges: EngineGraphEdge[] = [
      { id: "e1", source: "t", target: "c", sourceHandle: "out", targetHandle: "in" },
      { id: "e2", source: "c", target: "true-branch", sourceHandle: "true", targetHandle: "in" },
      { id: "e3", source: "c", target: "false-branch", sourceHandle: "false", targetHandle: "in" },
    ];

    const statuses = new Map<string, string>();
    await runGraph({ nodes, edges, runInput: null, signal, onStepEnd: (event) => { statuses.set(event.nodeId, event.status); } });

    expect(statuses.get("true-branch")).toBe("succeeded");
    expect(statuses.get("false-branch")).toBe("skipped");
  });

  it("a convergence point fed by both a live and a dead branch still runs (one live input is enough)", async () => {
    const nodes = [triggerNode("t"), conditionNode("c", "true"), outputNode("merge")];
    const edges: EngineGraphEdge[] = [
      { id: "e1", source: "t", target: "c", sourceHandle: "out", targetHandle: "in" },
      { id: "e2", source: "c", target: "merge", sourceHandle: "true", targetHandle: "in" },
      { id: "e3", source: "c", target: "merge", sourceHandle: "false", targetHandle: "in" },
    ];
    const statuses = new Map<string, string>();
    await runGraph({ nodes, edges, runInput: null, signal, onStepEnd: (event) => { statuses.set(event.nodeId, event.status); } });
    expect(statuses.get("merge")).toBe("succeeded");
  });
});

describe("runGraph: failure propagation (gate item 5)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("a failed node halts its own dependents (marks them skipped) without touching unrelated branches, and surfaces the resolved input", async () => {
    vi.doMock("@/lib/llm/provider", () => ({
      getProvider: () => ({
        // Not `async function*` -- a generator with no `yield` trips
        // ESLint's require-yield rule, and this genuinely never yields
        // (it always throws before producing a single chunk).
        stream: () => ({
          [Symbol.asyncIterator]() {
            return { next: () => Promise.reject(new Error("Groq is down")) };
          },
        }),
      }),
    }));
    const { runGraph: runGraphWithMockedLlm } = await import("./executor");

    function llmNode(id: string): EngineNode {
      return { id, type: "llm", data: { label: id, config: { model: "llama-3.3-70b-versatile", systemPrompt: "hi", temperature: 0.7 } } };
    }

    const nodes = [triggerNode("t"), llmNode("broken"), outputNode("downstream"), transformNode("unrelated")];
    const edges: EngineGraphEdge[] = [
      { id: "e1", source: "t", target: "broken", sourceHandle: "out", targetHandle: "prompt" },
      { id: "e2", source: "broken", target: "downstream", sourceHandle: "response", targetHandle: "in" },
    ];

    const statuses = new Map<string, string>();
    const errors = new Map<string, string | undefined>();
    const inputs = new Map<string, unknown>();
    const result = await runGraphWithMockedLlm({
      nodes,
      edges,
      runInput: { seed: 1 },
      signal,
      onStepEnd: (event) => {
        statuses.set(event.nodeId, event.status);
        errors.set(event.nodeId, event.errorMessage);
        inputs.set(event.nodeId, event.input);
      },
    });

    expect(statuses.get("broken")).toBe("failed");
    expect(errors.get("broken")).toContain("Groq is down");
    expect(inputs.get("broken")).toBeDefined(); // the resolved input that was fed to the failing node
    expect(statuses.get("downstream")).toBe("skipped");
    // An independent, unconnected node isn't touched by the failure elsewhere in the graph.
    expect(statuses.get("unrelated")).toBe("succeeded");
    expect(result.status).toBe("failed");
    expect(result.errorMessage).toContain("Groq is down");

    vi.doUnmock("@/lib/llm/provider");
  });
});

describe("runGraph: cancellation", () => {
  it("stops before running anything when the signal is already aborted, and reports the run as cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    const nodes = [triggerNode("t"), outputNode("o")];
    const edges: EngineGraphEdge[] = [{ id: "e1", source: "t", target: "o", sourceHandle: "out", targetHandle: "in" }];

    const stepEnds: string[] = [];
    const result = await runGraph({
      nodes,
      edges,
      runInput: null,
      signal: controller.signal,
      onStepEnd: (event) => {
        stepEnds.push(event.nodeId);
      },
    });

    expect(result.status).toBe("cancelled");
    expect(stepEnds).toEqual([]);
  });
});

describe("runGraph: disabled nodes", () => {
  it("skips a disabled node and its dependents without executing them", async () => {
    const nodes: EngineNode[] = [
      triggerNode("t"),
      { id: "d", type: "transform", data: { label: "disabled-node", config: { expression: "" }, disabled: true } },
      outputNode("o"),
    ];
    const edges: EngineGraphEdge[] = [
      { id: "e1", source: "t", target: "d", sourceHandle: "out", targetHandle: "input" },
      { id: "e2", source: "d", target: "o", sourceHandle: "output", targetHandle: "in" },
    ];
    const statuses = new Map<string, string>();
    await runGraph({ nodes, edges, runInput: null, signal, onStepEnd: (event) => { statuses.set(event.nodeId, event.status); } });
    expect(statuses.get("d")).toBe("skipped");
    expect(statuses.get("o")).toBe("skipped");
  });
});
