import { describe, expect, it } from "vitest";
import { normalizeSteps, type TraceStepInput } from "./playhead";
import { computeSegmentLayout } from "./timeline-segments";

const RUN_START = "2026-01-01T00:00:00.000Z";
function iso(ms: number): string {
  return new Date(new Date(RUN_START).getTime() + ms).toISOString();
}

describe("computeSegmentLayout -- gate item 3", () => {
  it("keeps non-overlapping sequential steps on a single row", () => {
    const steps: TraceStepInput[] = [
      { nodeId: "a", stepIndex: 0, name: "A", kind: "tool_call", status: "succeeded", startedAt: iso(0), finishedAt: iso(100), input: null, output: null },
      { nodeId: "b", stepIndex: 1, name: "B", kind: "tool_call", status: "succeeded", startedAt: iso(100), finishedAt: iso(200), input: null, output: null },
      { nodeId: "c", stepIndex: 2, name: "C", kind: "tool_call", status: "succeeded", startedAt: iso(200), finishedAt: iso(300), input: null, output: null },
    ];
    const layout = computeSegmentLayout(normalizeSteps(steps, RUN_START));
    expect(layout.every((item) => item.row === 0)).toBe(true);
  });

  it("stacks two genuinely overlapping steps onto separate rows", () => {
    const steps: TraceStepInput[] = [
      { nodeId: "a", stepIndex: 0, name: "A", kind: "tool_call", status: "succeeded", startedAt: iso(0), finishedAt: iso(500), input: null, output: null },
      { nodeId: "b", stepIndex: 1, name: "B", kind: "tool_call", status: "succeeded", startedAt: iso(100), finishedAt: iso(400), input: null, output: null },
    ];
    const layout = computeSegmentLayout(normalizeSteps(steps, RUN_START));
    const rowA = layout.find((item) => item.step.nodeId === "a")!.row;
    const rowB = layout.find((item) => item.step.nodeId === "b")!.row;
    expect(rowA).not.toBe(rowB);
  });

  it("reuses a row once its occupant has ended, even with more steps than fit at any one instant", () => {
    // a(0-100) and b(0-100) overlap (two rows); c(100-200) starts exactly
    // when both have ended, so it can reuse row 0 rather than opening a third.
    const steps: TraceStepInput[] = [
      { nodeId: "a", stepIndex: 0, name: "A", kind: "tool_call", status: "succeeded", startedAt: iso(0), finishedAt: iso(100), input: null, output: null },
      { nodeId: "b", stepIndex: 1, name: "B", kind: "tool_call", status: "succeeded", startedAt: iso(0), finishedAt: iso(100), input: null, output: null },
      { nodeId: "c", stepIndex: 2, name: "C", kind: "tool_call", status: "succeeded", startedAt: iso(100), finishedAt: iso(200), input: null, output: null },
    ];
    const layout = computeSegmentLayout(normalizeSteps(steps, RUN_START));
    const rowC = layout.find((item) => item.step.nodeId === "c")!.row;
    expect(rowC).toBe(0);
    const maxRow = Math.max(...layout.map((item) => item.row));
    expect(maxRow).toBe(1); // never opened a third row
  });

  it("handles three-way overlap by opening a third row", () => {
    const steps: TraceStepInput[] = [
      { nodeId: "a", stepIndex: 0, name: "A", kind: "tool_call", status: "succeeded", startedAt: iso(0), finishedAt: iso(300), input: null, output: null },
      { nodeId: "b", stepIndex: 1, name: "B", kind: "tool_call", status: "succeeded", startedAt: iso(50), finishedAt: iso(250), input: null, output: null },
      { nodeId: "c", stepIndex: 2, name: "C", kind: "tool_call", status: "succeeded", startedAt: iso(100), finishedAt: iso(200), input: null, output: null },
    ];
    const layout = computeSegmentLayout(normalizeSteps(steps, RUN_START));
    const rows = new Set(layout.map((item) => item.row));
    expect(rows.size).toBe(3);
  });
});
