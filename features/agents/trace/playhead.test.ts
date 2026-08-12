import { describe, expect, it } from "vitest";
import {
  deriveActiveEdgeIds,
  deriveCostCentsAtTime,
  deriveNodeStatesAtTime,
  effectiveRunDurationMs,
  nextEventTime,
  nodeDetailAtTime,
  normalizeSteps,
  previousEventTime,
  type NormalizedEdge,
  type TraceStepInput,
} from "./playhead";

const RUN_START = "2026-01-01T00:00:00.000Z";

function iso(ms: number): string {
  return new Date(new Date(RUN_START).getTime() + ms).toISOString();
}

/** Gate item 1's "three recorded runs with known step boundaries" -- three
 *  fixture step sets with hand-picked, exact millisecond boundaries so every
 *  assertion below is checking a known fact, not eyeballing a screenshot. */

// Run A: a straight sequential chain, no overlap -- trigger(0-0) ->
// transform(0-200) -> llm(200-1200) -> output(1200-1400).
const runASteps: TraceStepInput[] = [
  { nodeId: "trigger", stepIndex: 0, name: "Trigger", kind: "trigger", status: "succeeded", startedAt: iso(0), finishedAt: iso(0), input: null, output: { fired: true } },
  { nodeId: "transform", stepIndex: 1, name: "Transform", kind: "transform", status: "succeeded", startedAt: iso(0), finishedAt: iso(200), input: {}, output: { value: 1 } },
  { nodeId: "llm", stepIndex: 2, name: "LLM", kind: "llm_call", status: "succeeded", startedAt: iso(200), finishedAt: iso(1200), input: { prompt: "hi" }, output: { response: "hello" }, costCents: 0.5 },
  { nodeId: "output", stepIndex: 3, name: "Output", kind: "output", status: "succeeded", startedAt: iso(1200), finishedAt: iso(1400), input: {}, output: { ok: true } },
];
const runAEdges: NormalizedEdge[] = [
  { id: "e1", source: "trigger", target: "transform" },
  { id: "e2", source: "transform", target: "llm" },
  { id: "e3", source: "llm", target: "output" },
];

// Run B: a fan-out with two genuinely overlapping branches -- trigger(0-0)
// fires two tool calls that run concurrently (100-900 and 300-1100), both
// feeding a merge step (1100-1300). Also includes a skipped node (no
// timestamps recorded at all) to prove the synthesized-instant path.
const runBSteps: TraceStepInput[] = [
  { nodeId: "trigger", stepIndex: 0, name: "Trigger", kind: "trigger", status: "succeeded", startedAt: iso(0), finishedAt: iso(0), input: null, output: {} },
  { nodeId: "toolA", stepIndex: 1, name: "Tool A", kind: "tool_call", status: "succeeded", startedAt: iso(100), finishedAt: iso(900), input: {}, output: { a: 1 } },
  { nodeId: "toolB", stepIndex: 2, name: "Tool B", kind: "tool_call", status: "succeeded", startedAt: iso(300), finishedAt: iso(1100), input: {}, output: { b: 1 } },
  { nodeId: "skippedBranch", stepIndex: 3, name: "Skipped branch", kind: "condition", status: "skipped", startedAt: null, finishedAt: null, input: {}, output: null },
  { nodeId: "merge", stepIndex: 4, name: "Merge", kind: "output", status: "succeeded", startedAt: iso(1100), finishedAt: iso(1300), input: {}, output: { merged: true } },
];
const runBEdges: NormalizedEdge[] = [
  { id: "e1", source: "trigger", target: "toolA" },
  { id: "e2", source: "trigger", target: "toolB" },
  { id: "e3", source: "toolA", target: "merge" },
  { id: "e4", source: "toolB", target: "merge" },
  { id: "e5", source: "trigger", target: "skippedBranch" },
];

// Run C: a failure that halts a downstream node -- trigger(0-0) ->
// riskyCall(0-500, failed) -> neverRuns(skipped, no timestamps).
const runCSteps: TraceStepInput[] = [
  { nodeId: "trigger", stepIndex: 0, name: "Trigger", kind: "trigger", status: "succeeded", startedAt: iso(0), finishedAt: iso(0), input: null, output: {} },
  { nodeId: "riskyCall", stepIndex: 1, name: "Risky call", kind: "tool_call", status: "failed", startedAt: iso(0), finishedAt: iso(500), input: {}, output: null, errorMessage: "boom" },
  { nodeId: "neverRuns", stepIndex: 2, name: "Never runs", kind: "output", status: "skipped", startedAt: null, finishedAt: null, input: {}, output: null },
];

describe("normalizeSteps", () => {
  it("resolves real timestamps to ms-since-run-start", () => {
    const normalized = normalizeSteps(runASteps, RUN_START);
    expect(normalized.map((s) => [s.nodeId, s.startMs, s.endMs])).toEqual([
      ["trigger", 0, 0],
      ["transform", 0, 200],
      ["llm", 200, 1200],
      ["output", 1200, 1400],
    ]);
  });

  it("synthesizes an instant for a skipped step at the point execution reached it, not t=0", () => {
    const normalized = normalizeSteps(runBSteps, RUN_START);
    const skipped = normalized.find((s) => s.nodeId === "skippedBranch");
    // stepIndex 3, after toolA(100-900) and toolB(300-1100) -- cursor is 1100
    // by the time the walk reaches it.
    expect(skipped).toBeDefined();
    expect(skipped!.startMs).toBe(1100);
    expect(skipped!.endMs).toBe(1100);
  });
});

describe("deriveNodeStatesAtTime -- gate item 1 frame accuracy", () => {
  const normalized = normalizeSteps(runASteps, RUN_START);

  it("is pending before a node's recorded start", () => {
    const states = deriveNodeStatesAtTime(normalized, 50);
    expect(states.get("llm")).toBe("pending");
    expect(states.get("output")).toBe("pending");
  });

  it("is running strictly between start and end, not yet the final status", () => {
    const states = deriveNodeStatesAtTime(normalized, 600);
    expect(states.get("transform")).toBe("succeeded"); // already finished at t=200
    expect(states.get("llm")).toBe("running"); // 200 <= 600 < 1200
    expect(states.get("output")).toBe("pending");
  });

  it("is the real recorded status once a step has finished", () => {
    const states = deriveNodeStatesAtTime(normalized, 1400);
    expect(states.get("trigger")).toBe("succeeded");
    expect(states.get("transform")).toBe("succeeded");
    expect(states.get("llm")).toBe("succeeded");
    expect(states.get("output")).toBe("succeeded");
  });

  it("surfaces a failed step's real status once it ends, and never claims success", () => {
    const normalizedC = normalizeSteps(runCSteps, RUN_START);
    expect(deriveNodeStatesAtTime(normalizedC, 250).get("riskyCall")).toBe("running");
    expect(deriveNodeStatesAtTime(normalizedC, 500).get("riskyCall")).toBe("failed");
    // A skipped node with no timestamps is synthesized at the cursor (500,
    // right after riskyCall) -- pending before that instant, skipped after.
    expect(deriveNodeStatesAtTime(normalizedC, 499).get("neverRuns")).toBe("pending");
    expect(deriveNodeStatesAtTime(normalizedC, 500).get("neverRuns")).toBe("skipped");
  });
});

describe("gate item 3 -- overlapping parallel executions", () => {
  const normalized = normalizeSteps(runBSteps, RUN_START);

  it("shows two genuinely concurrent nodes both running at the same instant", () => {
    // toolA: 100-900, toolB: 300-1100 -- both running at t=500.
    const states = deriveNodeStatesAtTime(normalized, 500);
    expect(states.get("toolA")).toBe("running");
    expect(states.get("toolB")).toBe("running");
  });

  it("stops overlapping once one branch finishes while the other continues", () => {
    const states = deriveNodeStatesAtTime(normalized, 950);
    expect(states.get("toolA")).toBe("succeeded");
    expect(states.get("toolB")).toBe("running");
  });
});

describe("deriveActiveEdgeIds", () => {
  const normalized = normalizeSteps(runASteps, RUN_START);

  it("is active only in the transit window between source end and target start", () => {
    // transform ends at 200, llm starts at 200 -- zero-width transit window,
    // never active (nothing to catch mid-transit).
    expect(deriveActiveEdgeIds(runAEdges, normalized, 200).has("e2")).toBe(false);
  });

  it("is active between a real gap", () => {
    // llm ends at 1200, output starts at 1200 -- also zero width. Use run B's
    // trigger(0-0) -> toolA(100-900) gap instead, which has a real 100ms window.
    const normalizedB = normalizeSteps(runBSteps, RUN_START);
    expect(deriveActiveEdgeIds(runBEdges, normalizedB, 50).has("e1")).toBe(true);
    expect(deriveActiveEdgeIds(runBEdges, normalizedB, 150).has("e1")).toBe(false);
  });

  it("never activates an edge into a skipped node", () => {
    const normalizedB = normalizeSteps(runBSteps, RUN_START);
    expect(deriveActiveEdgeIds(runBEdges, normalizedB, 50).has("e5")).toBe(false);
  });
});

describe("deriveCostCentsAtTime -- gate item 5", () => {
  const normalized = normalizeSteps(runASteps, RUN_START);

  it("accumulates only completed steps' cost before the run ends", () => {
    expect(deriveCostCentsAtTime(normalized, 600, 1400, 0.5)).toBe(0); // llm hasn't finished yet
    expect(deriveCostCentsAtTime(normalized, 1250, 1400, 0.5)).toBe(0.5); // llm finished at 1200
  });

  it("snaps to the run's exact recorded total once the playhead reaches the end", () => {
    expect(deriveCostCentsAtTime(normalized, 1400, 1400, 0.5)).toBe(0.5);
    expect(deriveCostCentsAtTime(normalized, 5000, 1400, 0.5)).toBe(0.5);
  });
});

describe("nodeDetailAtTime -- gate item 4", () => {
  const normalized = normalizeSteps(runASteps, RUN_START);

  it("shows nothing before the node has started, not the eventual final input", () => {
    const detail = nodeDetailAtTime(normalized, "llm", 50);
    expect(detail.status).toBe("pending");
    expect(detail.step).toBeNull();
  });

  it("shows the resolved input while running, before there's any output", () => {
    const detail = nodeDetailAtTime(normalized, "llm", 600);
    expect(detail.status).toBe("running");
    expect(detail.step?.input).toEqual({ prompt: "hi" });
    expect(detail.hasOutput).toBe(false);
  });

  it("shows output only once the step has actually finished", () => {
    const detail = nodeDetailAtTime(normalized, "llm", 1200);
    expect(detail.status).toBe("succeeded");
    expect(detail.hasOutput).toBe(true);
    expect(detail.step?.output).toEqual({ response: "hello" });
  });
});

describe("event stepping -- gate item 7", () => {
  const normalized = normalizeSteps(runASteps, RUN_START);
  const duration = effectiveRunDurationMs(normalized, 1400);

  it("steps forward to the next state-change instant, not a fixed delta", () => {
    expect(nextEventTime(normalized, 0, duration)).toBe(200);
    expect(nextEventTime(normalized, 200, duration)).toBe(1200);
    expect(nextEventTime(normalized, 1200, duration)).toBe(1400);
    expect(nextEventTime(normalized, 1400, duration)).toBe(1400); // clamped at the end
  });

  it("steps backward to the previous state-change instant", () => {
    expect(previousEventTime(normalized, 1400, duration)).toBe(1200);
    expect(previousEventTime(normalized, 1200, duration)).toBe(200);
    expect(previousEventTime(normalized, 200, duration)).toBe(0);
    expect(previousEventTime(normalized, 0, duration)).toBe(0); // clamped at the start
  });
});

describe("effectiveRunDurationMs", () => {
  it("uses the recorded duration when it already covers every step", () => {
    const normalized = normalizeSteps(runASteps, RUN_START);
    expect(effectiveRunDurationMs(normalized, 2000)).toBe(2000);
  });

  it("extends to the last step's end if the recorded duration is shorter", () => {
    const normalized = normalizeSteps(runASteps, RUN_START);
    expect(effectiveRunDurationMs(normalized, 1000)).toBe(1400);
  });
});
