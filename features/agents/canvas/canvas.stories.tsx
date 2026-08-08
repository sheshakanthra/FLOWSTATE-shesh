import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { Canvas } from "./index";
import { useGraphStore, type CanvasEdge, type CanvasNode } from "../store/graph-store";
import { getNodeType, listNodeTypes } from "../nodes/registry";

const BENCHMARK_NODE_COUNT = 300;
const BENCHMARK_EDGE_COUNT = 400;

/**
 * Chain-plus-wraparound: cheap to generate, and past `nodeCount` edges the
 * source/target pairs start repeating (parallel edges), which is fine for a
 * synthetic render-load benchmark -- it doesn't need to be a meaningful
 * graph, just BENCHMARK_EDGE_COUNT real edges with valid endpoints.
 *
 * Nodes cycle through every registered node type (not a single "generic"
 * placeholder) so the perf gate exercises real NodeShell instances with
 * real ports -- gate item 8, "300-node benchmark from B1 still passes with
 * real node types."
 */
function buildBenchmarkGraph(nodeCount: number, edgeCount: number): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const definitions = listNodeTypes();
  const columns = 20;
  const spacingX = 220;
  const spacingY = 140;
  const nodes: CanvasNode[] = Array.from({ length: nodeCount }, (_, index) => {
    const definition = definitions[index % definitions.length]!;
    return {
      id: `bench-node-${index}`,
      type: definition.id,
      position: { x: (index % columns) * spacingX, y: Math.floor(index / columns) * spacingY },
      data: { label: definition.label, config: { ...definition.defaultConfig } },
    };
  });

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
// drag start point. A mix of real node types (not all "generic") so the
// interaction tests exercise the real NodeShell footprint.
function interactiveNode(id: string, typeId: string, label: string, position: { x: number; y: number }): CanvasNode {
  const definition = getNodeType(typeId);
  return { id, type: typeId, position, data: { label, config: { ...definition?.defaultConfig } } };
}

const INTERACTIVE_NODES: CanvasNode[] = [
  interactiveNode("int-0", "trigger", "Node 1", { x: 100, y: 100 }),
  interactiveNode("int-1", "llm", "Node 2", { x: 400, y: 100 }),
  interactiveNode("int-2", "condition", "Node 3", { x: 700, y: 100 }),
  interactiveNode("int-3", "tool", "Node 4", { x: 100, y: 350 }),
  interactiveNode("int-4", "output", "Node 5", { x: 400, y: 350 }),
  interactiveNode("int-5", "humanInLoop", "Node 6", { x: 700, y: 350 }),
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

/**
 * A small, hand-picked graph for exercising typed connections directly --
 * used by e2e/canvas-connections.spec.ts. Two LLM nodes give a concrete,
 * reachable instance of the spec's own "text -> document is impossible"
 * example (llm-a's `response` text output into llm-b's `context` document
 * input); three Condition nodes, pre-wired a -> b -> c, give a real
 * cycle-rejection case (c -> a would close the loop).
 */
// x >= 350 so nothing sits under the NodeLibraryPanel, which docks at the
// pane's actual top-left corner (see e2e/canvas-interactions.spec.ts's
// box-select test, which hit the same collision).
const CONNECTIONS_NODES: CanvasNode[] = [
  interactiveNode("llm-a", "llm", "LLM A", { x: 350, y: 60 }),
  interactiveNode("llm-b", "llm", "LLM B", { x: 680, y: 60 }),
  interactiveNode("cond-a", "condition", "Condition A", { x: 350, y: 320 }),
  interactiveNode("cond-b", "condition", "Condition B", { x: 680, y: 320 }),
  interactiveNode("cond-c", "condition", "Condition C", { x: 960, y: 320 }),
];

const CONNECTIONS_EDGES: CanvasEdge[] = [
  { id: "edge-a-b", source: "cond-a", sourceHandle: "true", target: "cond-b", targetHandle: "in" },
  { id: "edge-b-c", source: "cond-b", sourceHandle: "true", target: "cond-c", targetHandle: "in" },
];

function ConnectionsRender() {
  React.useEffect(() => {
    useGraphStore.getState().setGraph(CONNECTIONS_NODES, CONNECTIONS_EDGES);
    return () => useGraphStore.getState().setGraph([], []);
  }, []);

  return (
    <div style={{ height: 800, width: "100%" }}>
      <Canvas />
    </div>
  );
}

export const Connections: Story = {
  render: () => <ConnectionsRender />,
};
