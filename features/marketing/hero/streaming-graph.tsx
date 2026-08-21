"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  BaseEdge,
  getBezierPath,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  type EdgeProps,
  type EdgeTypes,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import { cn } from "@/lib/utils";
import { useMotion } from "@/lib/motion";
import { Shimmer } from "@/components/motion/shimmer";
import { CanvasBackground } from "@/features/agents/canvas/background";
import { FIT_VIEW_PADDING } from "@/features/agents/lib/viewport";
import { Port } from "@/features/agents/nodes/port";
import { listNodeTypes, type AgentNode, type AnyNodeTypeDefinition } from "@/features/agents/nodes/registry";
import { useDemoRunStore } from "./demo-run-store";

/**
 * The hero canvas (E1 spec item 2-3): a real, read-only `@xyflow/react`
 * instance, its own `ReactFlowProvider` instance -- same isolation reasoning
 * as B5's trace replay canvas (see PROGRESS.md): this must never touch
 * `graph-store`/`canvas-store`/`run-store`, the authenticated builder's
 * module-level singletons, since this component can be mounted on a public,
 * unauthenticated route. `Port` and `Shimmer` are reused as-is (purely
 * presentational, no store coupling of their own beyond the keyboard-
 * connection/graph-store read `Port` only makes while a connection drag is
 * actually in progress -- impossible here since `nodesConnectable` is always
 * false), so a node here renders pixel-identical to the real product's.
 */

export interface StreamingGraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface StreamingGraphProps {
  nodes: AgentNode[];
  edges: StreamingGraphEdge[];
}

interface HeroNodeProps extends NodeProps<AgentNode> {
  definition: AnyNodeTypeDefinition;
}

const STATUS_BORDER: Record<string, string> = {
  running: "border-blue-fg",
  succeeded: "border-emerald-line",
  failed: "border-red-line",
  skipped: "border-ink-400",
  pending: "border-ink-400",
};

/** Every newly mounted node fades and rises in on `base` (auto-collapses to
 *  a 90ms crossfade under reduced motion via `useMotion` -- see lib/motion.ts
 *  -- so this component never branches on the media query itself). Whether
 *  nodes mount one at a time (staggered) or all together is decided by the
 *  caller (index.tsx), which is also where "renders complete" for reduced
 *  motion (gate item 8) is decided, since that's a reveal-*timing* choice,
 *  not this component's own concern. */
function HeroNodeComponent({ id, data, definition }: HeroNodeProps) {
  const status = useDemoRunStore((state) => state.nodeStatuses[id] ?? "pending");
  const { base } = useMotion();
  const configResult = definition.configSchema.safeParse(data.config);
  const summary = configResult.success ? definition.summary(configResult.data) : definition.description;
  const Icon = definition.icon;

  const content = (
    <>
      <div className="flex items-center gap-2 px-3 py-2">
        <div
          aria-hidden="true"
          className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-ink-200 text-fg-200"
        >
          <Icon className="size-3.5" />
        </div>
        <span className="truncate text-label text-fg-000">{data.label}</span>
      </div>
      <div className="truncate border-t border-ink-400/60 px-3 py-1.5 text-meta text-fg-100">{summary}</div>
      {definition.inputs.map((port, index) => (
        <Port
          key={port.id}
          nodeId={id}
          port={port}
          direction="input"
          index={index}
          total={definition.inputs.length}
          isConnectable={false}
        />
      ))}
      {definition.outputs.map((port, index) => (
        <Port
          key={port.id}
          nodeId={id}
          port={port}
          direction="output"
          index={index}
          total={definition.outputs.length}
          isConnectable={false}
        />
      ))}
    </>
  );

  return (
    <motion.div
      data-run-status={status}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: base.duration, ease: base.ease }}
      className={cn(
        "relative flex w-44 flex-col rounded-lg border bg-ink-100 shadow-card",
        STATUS_BORDER[status],
        status === "skipped" && "opacity-50",
      )}
    >
      {status === "running" ? <Shimmer className="rounded-[inherit]">{content}</Shimmer> : content}
    </motion.div>
  );
}

function buildHeroNodeTypes(): NodeTypes {
  const map: NodeTypes = {};
  for (const definition of listNodeTypes()) {
    const Component = React.memo(function HeroRegisteredNode(props: NodeProps<AgentNode>) {
      return <HeroNodeComponent {...props} definition={definition} />;
    });
    Component.displayName = `HeroNode(${definition.id})`;
    map[definition.id] = Component;
  }
  return map;
}

const heroNodeTypes = buildHeroNodeTypes();

/** Traveling-pulse edge, mirroring `features/agents/canvas/run-edge.tsx`:
 *  reads whether its own source node is `"running"` from the hero's own
 *  store, an SVG `<animateMotion>` along the edge's own bezier path so it
 *  needs no per-frame JS, and is naturally absent under reduced motion by
 *  simply not rendering the pulse circle at all. */
function HeroEdge({ id, source, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const sourceStatus = useDemoRunStore((state) => state.nodeStatuses[source]);
  const isActive = sourceStatus === "running";
  const { prefersReducedMotion } = useMotion();

  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      {isActive && !prefersReducedMotion ? (
        <circle r={3.5} className="fill-blue-fg" aria-hidden="true">
          <animateMotion dur="1.1s" repeatCount="indefinite" path={path} />
        </circle>
      ) : null}
    </>
  );
}

const heroEdgeTypes: EdgeTypes = { default: HeroEdge };

/** Re-fits the viewport whenever the node count grows -- `fitView` as a
 *  React Flow prop only ever fires on the instance's own first render, which
 *  isn't enough here since nodes keep arriving after mount as the graph
 *  streams in.
 *
 * `useNodesInitialized()` looked like the correct gate (only fit once every
 * current node has a real measured width/height), but its underlying store
 * flag never actually flips to `true` for this canvas -- confirmed live via
 * a running instance: it stays `false` indefinitely even seconds after the
 * graph has visibly finished laying out and every node is fully rendered.
 * Gating on it left `fitView` never called at all (the viewport stuck at
 * the untransformed default, clipping most of the graph outside the
 * frame). Calling `fitView` unconditionally on every `nodeCount` change
 * instead -- still after the node's own DOM has committed, since this runs
 * in a `useEffect`, not during render -- reliably measures real, on-screen
 * node bounds in practice. `nodesInitialized` stays in the dependency array
 * so a later flip to `true` still triggers one more (harmless) fit. */
function FitViewOnNodeCountChange({ nodeCount }: { nodeCount: number }) {
  const { fitView } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  React.useEffect(() => {
    if (nodeCount === 0) return;
    void fitView({ padding: FIT_VIEW_PADDING, duration: 200 });
  }, [nodeCount, nodesInitialized, fitView]);
  return null;
}

function StreamingGraphInner({ nodes, edges }: StreamingGraphProps) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={heroNodeTypes}
      edgeTypes={heroEdgeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag
      zoomOnScroll={false}
      proOptions={{ hideAttribution: true }}
    >
      <CanvasBackground />
      <FitViewOnNodeCountChange nodeCount={nodes.length} />
    </ReactFlow>
  );
}

export function StreamingGraph({ nodes, edges }: StreamingGraphProps) {
  return (
    <ReactFlowProvider>
      <StreamingGraphInner nodes={nodes} edges={edges} />
    </ReactFlowProvider>
  );
}

export default StreamingGraph;
