import { describe, expect, it } from "vitest";
import { findCycle } from "./cycle-detect";

const labels = new Map([
  ["a", "Trigger"],
  ["b", "LLM"],
  ["c", "Condition"],
]);

describe("findCycle", () => {
  it("returns null when the candidate edge doesn't close a loop", () => {
    const edges = [{ source: "a", target: "b" }];
    expect(findCycle(edges, { source: "b", target: "c" }, labels)).toBeNull();
  });

  it("detects a direct two-node cycle and names both nodes, starting from the new edge's source", () => {
    const edges = [{ source: "a", target: "b" }];
    const cycle = findCycle(edges, { source: "b", target: "a" }, labels);
    expect(cycle).toEqual(["LLM", "Trigger", "LLM"]);
  });

  it("detects a longer cycle and names every node on it in order", () => {
    const edges = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ];
    const cycle = findCycle(edges, { source: "c", target: "a" }, labels);
    expect(cycle).toEqual(["Condition", "Trigger", "LLM", "Condition"]);
  });

  it("treats a self-loop as a trivial one-node cycle", () => {
    const cycle = findCycle([], { source: "a", target: "a" }, labels);
    expect(cycle).toEqual(["Trigger", "Trigger"]);
  });

  it("falls back to raw ids when a node has no label entry", () => {
    const cycle = findCycle([{ source: "x", target: "y" }], { source: "y", target: "x" }, new Map());
    expect(cycle).toEqual(["y", "x", "y"]);
  });
});
