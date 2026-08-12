import { describe, expect, it } from "vitest";
import { normalizeSteps, type TraceStepInput } from "./playhead";
import { computeLineDiff, findChangedNodes } from "./run-diff";

const RUN_START = "2026-01-01T00:00:00.000Z";
function iso(ms: number): string {
  return new Date(new Date(RUN_START).getTime() + ms).toISOString();
}

function step(overrides: Partial<TraceStepInput> & Pick<TraceStepInput, "nodeId" | "stepIndex">): TraceStepInput {
  return {
    name: overrides.nodeId,
    kind: "tool_call",
    status: "succeeded",
    startedAt: iso(0),
    finishedAt: iso(100),
    input: null,
    output: null,
    ...overrides,
  };
}

describe("findChangedNodes -- gate item 9", () => {
  it("flags a node whose output text differs between two runs", () => {
    const current = normalizeSteps(
      [step({ nodeId: "llm", stepIndex: 0, output: { response: "Hello there" } })],
      RUN_START,
    );
    const compare = normalizeSteps(
      [step({ nodeId: "llm", stepIndex: 0, output: { response: "Hi!" } })],
      RUN_START,
    );
    const entries = findChangedNodes(current, compare);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.changed).toBe(true);
    expect(entries[0]!.nodeId).toBe("llm");
  });

  it("does not flag a node whose output is identical", () => {
    const current = normalizeSteps([step({ nodeId: "llm", stepIndex: 0, output: { response: "Same" } })], RUN_START);
    const compare = normalizeSteps([step({ nodeId: "llm", stepIndex: 0, output: { response: "Same" } })], RUN_START);
    const entries = findChangedNodes(current, compare);
    expect(entries[0]!.changed).toBe(false);
  });

  it("does not flag a node neither run reached", () => {
    const current = normalizeSteps(
      [step({ nodeId: "a", stepIndex: 0, output: { x: 1 } }), step({ nodeId: "b", stepIndex: 1, status: "skipped", startedAt: null, finishedAt: null })],
      RUN_START,
    );
    const compare = normalizeSteps(
      [step({ nodeId: "a", stepIndex: 0, output: { x: 1 } }), step({ nodeId: "b", stepIndex: 1, status: "skipped", startedAt: null, finishedAt: null })],
      RUN_START,
    );
    const entries = findChangedNodes(current, compare);
    expect(entries.find((entry) => entry.nodeId === "b")!.changed).toBe(false);
  });

  it("flags a node that succeeded in one run but was skipped/failed in the other", () => {
    const current = normalizeSteps([step({ nodeId: "branch", stepIndex: 0, output: { taken: true } })], RUN_START);
    const compare = normalizeSteps(
      [step({ nodeId: "branch", stepIndex: 0, status: "skipped", startedAt: null, finishedAt: null, output: null })],
      RUN_START,
    );
    const entries = findChangedNodes(current, compare);
    expect(entries[0]!.changed).toBe(true);
  });
});

describe("computeLineDiff", () => {
  it("marks unchanged lines as same and changed lines as added/removed", () => {
    const before = "line one\nline two\nline three";
    const after = "line one\nline TWO\nline three";
    const diff = computeLineDiff(before, after);
    expect(diff.filter((line) => line.type === "removed").map((line) => line.text)).toEqual(["line two"]);
    expect(diff.filter((line) => line.type === "added").map((line) => line.text)).toEqual(["line TWO"]);
    expect(diff.filter((line) => line.type === "same")).toHaveLength(2);
  });

  it("handles a completely different string as a full removal + addition", () => {
    const diff = computeLineDiff("abc", "xyz");
    expect(diff).toEqual([
      { type: "removed", text: "abc" },
      { type: "added", text: "xyz" },
    ]);
  });
});
