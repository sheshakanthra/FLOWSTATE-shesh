import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { Canvas } from "./index";
import { useGraphStore, type CanvasEdge, type CanvasNode } from "../store/graph-store";

const BENCHMARK_NODE_COUNT = 300;
const BENCHMARK_EDGE_COUNT = 400;

/**
 * Chain-plus-wraparound: cheap to generate, and past `nodeCount` edges the
 * source/target pairs start repeating (parallel edges), which is fine for a
 * synthetic render-load benchmark -- it doesn't need to be a meaningful
 * graph, just BENCHMARK_EDGE_COUNT real edges with valid endpoints.
 */
function buildBenchmarkGraph(nodeCount: number, edgeCount: number): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const columns = 20;
  const spacingX = 220;
  const spacingY = 140;
  const nodes: CanvasNode[] = Array.from({ length: nodeCount }, (_, index) => ({
    id: `bench-node-${index}`,
    type: "generic",
    position: { x: (index % columns) * spacingX, y: Math.floor(index / columns) * spacingY },
    data: { label: `Node ${index + 1}` },
  }));

  const edges: CanvasEdge[] = [];
  for (let index = 0; edges.length < edgeCount; index += 1) {
    const source = index % nodeCount;
    const target = (index + 1) % nodeCount;
    edges.push({ id: `bench-edge-${index}`, source: `bench-node-${source}`, target: `bench-node-${target}` });
  }
  return { nodes, edges };
}

/**
 * Seeds useGraphStore directly rather than through any UI -- there's no
 * "add 300 nodes" affordance in the product (nor should there be), and the
 * store is a plain module-level Zustand store any client code can call
 * into, so a story is the natural place to stand up a synthetic dataset for
 * the perf gate. e2e/canvas-benchmark.spec.ts drives this exact story.
 */
function BenchmarkRender() {
  React.useEffect(() => {
    const { nodes, edges } = buildBenchmarkGraph(BENCHMARK_NODE_COUNT, BENCHMARK_EDGE_COUNT);
    useGraphStore.getState().setGraph(nodes, edges);
    return () => useGraphStore.getState().setGraph([], []);
  }, []);

  return (
    <div style={{ height: 800, width: "100%" }} data-testid="canvas-benchmark-root">
      <Canvas />
    </div>
  );
}

const meta: Meta = {
  title: "Features/Agents/Canvas",
};

export default meta;
type Story = StoryObj;

export const Empty: Story = {
  render: () => (
    <div style={{ height: 800, width: "100%" }}>
      <Canvas />
    </div>
  ),
};

export const Benchmark: Story = {
  name: "300 nodes / 400 edges",
  render: () => <BenchmarkRender />,
};

// Offset from the flow origin (not (0,0)) so a selection box drawn just
// inside the pane's own screen edge can still start above/left of every
// node's rendered box -- see e2e/canvas-interactions.spec.ts's box-select
// test, which needs room to fully enclose a node from a valid pane-internal
// drag start point.
const INTERACTIVE_NODES: CanvasNode[] = [
  { id: "int-0", type: "generic", position: { x: 100, y: 100 }, data: { label: "Node 1" } },
  { id: "int-1", type: "generic", position: { x: 400, y: 100 }, data: { label: "Node 2" } },
  { id: "int-2", type: "generic", position: { x: 700, y: 100 }, data: { label: "Node 3" } },
  { id: "int-3", type: "generic", position: { x: 100, y: 350 }, data: { label: "Node 4" } },
  { id: "int-4", type: "generic", position: { x: 400, y: 350 }, data: { label: "Node 5" } },
  { id: "int-5", type: "generic", position: { x: 700, y: 350 }, data: { label: "Node 6" } },
];

/** Fixed, widely-spaced node positions -- used by
 *  e2e/canvas-interactions.spec.ts, where box-select enclosure and
 *  shift-drag-additive need geometry it can reason about precisely, unlike
 *  the benchmark story's dense synthetic grid. */
function InteractiveRender() {
  React.useEffect(() => {
    useGraphStore.getState().setGraph(INTERACTIVE_NODES, []);
    return () => useGraphStore.getState().setGraph([], []);
  }, []);

  return (
    <div style={{ height: 800, width: "100%" }}>
      <Canvas />
    </div>
  );
}

export const Interactive: Story = {
  render: () => <InteractiveRender />,
};
