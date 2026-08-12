"use client";

import * as React from "react";
import {
  BaseEdge,
  ReactFlow,
  ReactFlowProvider,
  getBezierPath,
  type EdgeProps,
  type EdgeTypes,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import { Link as LinkIcon, LayoutGrid } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SplitPane } from "@/components/ui/split-pane";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useMotion, useReducedMotion } from "@/lib/motion";
import { listNodeTypes, type AgentNode, type AnyNodeTypeDefinition } from "../nodes/registry";
import { Port } from "../nodes/port";
import { Shimmer } from "@/components/motion/shimmer";
import { CanvasBackground } from "../canvas/background";
import { CanvasMiniMap } from "../canvas/minimap";
import { FIT_VIEW_PADDING } from "../lib/viewport";
import { formatTimestamp } from "../lib/format";
import { normalizeSteps, type NodeReplayStatus, type NormalizedEdge, type TraceStepInput } from "./playhead";
import { useReplayStore } from "./replay-store";
import { Scrubber } from "./scrubber";
import { NodeDetail } from "./node-detail";
import { RunDiff, type AvailableRun } from "./run-diff";

export interface TraceGraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface TraceGraph {
  nodes: AgentNode[];
  edges: TraceGraphEdge[];
}

export interface TraceRunSummary {
  id: string;
  status: "running" | "succeeded" | "failed" | "cancelled";
  trigger: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  costUsd: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  errorMessage: string | null;
}

const RUN_STATUS_BADGE: Record<TraceRunSummary["status"], { label: string; variant: BadgeVariant }> = {
  running: { label: "Running", variant: "blue" },
  succeeded: { label: "Succeeded", variant: "emerald" },
  failed: { label: "Failed", variant: "red" },
  cancelled: { label: "Cancelled", variant: "neutral" },
};

const REPLAY_STATUS_BORDER: Record<NodeReplayStatus, string> = {
  pending: "border-ink-400",
  running: "border-blue-fg",
  succeeded: "border-emerald-line",
  failed: "border-red-line",
  skipped: "border-dashed border-ink-500",
};

interface ReplayNodeProps extends NodeProps<AgentNode> {
  definition: AnyNodeTypeDefinition;
}

/**
 * Trace mode's own node renderer -- deliberately not NodeShell (B2/B4).
 * NodeShell reads live per-run state from run-store.ts (the test console's
 * "this run, right now" concept) and is meant for the editable canvas;
 * replay needs a node driven by `(steps, playheadMs)` at an arbitrary
 * historical instant instead, on a canvas that must never be draggable or
 * connectable. Reusing Port keeps the two node renderings visually
 * consistent (same icon/summary/port layout a user built), without
 * reaching into NodeShell's live-run coupling. Border-color/opacity
 * transitions are bound to the resolved motion duration (base under normal
 * motion, instant under reduced motion) so a state change crossfades either
 * way -- gate item 8 asks specifically for reduced motion to still
 * crossfade, not do nothing.
 */
function ReplayNodeComponent({ id, data, definition }: ReplayNodeProps) {
  const status = useReplayStore((state) => state.nodeStates[id] ?? "pending");
  const selectedNodeId = useReplayStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useReplayStore((state) => state.setSelectedNodeId);
  const { base, instant, prefersReducedMotion } = useMotion();
  const durationMs = (prefersReducedMotion ? instant : base).duration * 1000;

  const configResult = definition.configSchema.safeParse(data.config);
  const summary = configResult.success ? definition.summary(configResult.data) : "Invalid configuration";
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
    <button
      type="button"
      onClick={() => setSelectedNodeId(id)}
      data-run-status={status}
      aria-pressed={selectedNodeId === id}
      style={{ transition: `border-color ${durationMs}ms, outline-color ${durationMs}ms, opacity ${durationMs}ms` }}
      className={cn(
        // React Flow sets `pointer-events: none` inline on its own node
        // wrapper whenever a node is neither draggable nor selectable
        // (both true here, deliberately -- "no editing during replay").
        // That inline style otherwise wins over the wrapper's own CSS class
        // and would be inherited by this button too, silently swallowing
        // clicks -- explicit `pointer-events-auto` here overrides it back
        // on, scoped to just the one element that actually needs clicks.
        //
        // A fixed `w-44` (not NodeShell's own `min-w-44`, which has no
        // upper bound): the seeded graph's columns sit 220px apart, and a
        // node type whose summary text is long (the LLM node's system
        // prompt) can otherwise grow past that -- Tailwind's `truncate`
        // does nothing without a bounded width to truncate against, so an
        // unbounded node silently overlaps its neighbor instead of eliding
        // its own text. Caught by this session's own e2e run: the LLM
        // node's real 518px-wide unbounded button visually covered the
        // output node beside it, swallowing the click meant for it.
        "pointer-events-auto relative flex w-44 cursor-pointer flex-col rounded-lg border bg-ink-100 text-left shadow-card",
        REPLAY_STATUS_BORDER[status],
        status === "pending" && "opacity-40",
        "outline outline-2 outline-offset-2",
        selectedNodeId === id ? "outline-blue-fg" : "outline-transparent",
      )}
    >
      {status === "running" ? <Shimmer className="rounded-[inherit]">{content}</Shimmer> : content}
    </button>
  );
}

function buildReplayNodeTypes(): NodeTypes {
  const map: NodeTypes = {};
  for (const definition of listNodeTypes()) {
    const Component = React.memo(function ReplayRegisteredNode(props: NodeProps<AgentNode>) {
      return <ReplayNodeComponent {...props} definition={definition} />;
    });
    Component.displayName = `ReplayNode(${definition.id})`;
    map[definition.id] = Component;
  }
  return map;
}

const replayNodeTypes = buildReplayNodeTypes();

/** Gate item 8: unlike B4's live RunEdge (which simply renders nothing extra
 *  under reduced motion -- a defensible choice there, since the live console
 *  has no other requirement to satisfy), replay's own gate wording is
 *  explicit: "edge pulses are static highlights" under reduced motion, not
 *  absent. So this is its own edge component, not a reuse of run-edge.tsx. */
function ReplayEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const isActive = useReplayStore((state) => state.activeEdgeIds.has(id));
  const prefersReducedMotion = useReducedMotion();

  const edgeStyle =
    isActive && prefersReducedMotion ? { ...style, stroke: "var(--color-blue-fg)", strokeWidth: 2.5 } : style;

  return (
    <>
      <BaseEdge id={id} path={path} style={edgeStyle} markerEnd={markerEnd} />
      {isActive && !prefersReducedMotion ? (
        <circle r={3.5} className="fill-blue-fg" aria-hidden="true">
          <animateMotion dur="1.1s" repeatCount="indefinite" path={path} />
        </circle>
      ) : null}
    </>
  );
}

const replayEdgeTypes: EdgeTypes = { default: ReplayEdge };

function formatDuration(durationMs: number | null): string {
  if (durationMs === null) return "—";
  return `${(durationMs / 1000).toFixed(1)}s`;
}

export interface TraceViewProps {
  agentId: string;
  agentName: string;
  workspaceSlug: string;
  graph: TraceGraph | null;
  run: TraceRunSummary;
  steps: TraceStepInput[];
  availableRuns: AvailableRun[];
  initialPlayheadMs: number;
}

function ReplayCanvas({ graph }: { graph: TraceGraph }) {
  const setSelectedNodeId = useReplayStore((state) => state.setSelectedNodeId);
  return (
    <ReactFlow
      nodes={graph.nodes}
      edges={graph.edges}
      nodeTypes={replayNodeTypes}
      edgeTypes={replayEdgeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      edgesFocusable={false}
      elementsSelectable={false}
      panOnScroll
      fitView
      fitViewOptions={{ padding: FIT_VIEW_PADDING }}
      onPaneClick={() => setSelectedNodeId(null)}
      proOptions={{ hideAttribution: true }}
    >
      <CanvasBackground />
      <CanvasMiniMap />
    </ReactFlow>
  );
}

/**
 * The trace replay screen (session spec items 2-6): a read-only canvas
 * (deliberately its own ReactFlow instance, not features/agents/canvas's
 * editable Canvas -- "no editing during replay" means it must never touch
 * graph-store/canvas-store, the live builder's singletons) driven entirely
 * by replay-store's playhead, with the scrubber pinned below it exactly as
 * the spec names.
 */
export function TraceView({ agentId, agentName, workspaceSlug, graph, run, steps, availableRuns, initialPlayheadMs }: TraceViewProps) {
  const loadTrace = useReplayStore((state) => state.loadTrace);
  const currentSteps = useReplayStore((state) => state.steps);

  React.useEffect(() => {
    const runStartedAt = run.startedAt;
    const normalized = normalizeSteps(steps, runStartedAt);
    const edges: NormalizedEdge[] = graph?.edges ?? [];
    const lastStepEnd = normalized.reduce((max, step) => Math.max(max, step.endMs), 0);
    const recordedDurationMs = run.durationMs ?? lastStepEnd;
    const runDurationMs = Math.max(recordedDurationMs, lastStepEnd);
    const finalTotalCostCents = run.costUsd !== null ? run.costUsd * 100 : normalized.reduce((sum, s) => sum + (s.costCents ?? 0), 0);

    loadTrace({
      runId: run.id,
      steps: normalized,
      edges,
      runDurationMs,
      finalTotalCostCents,
      initialPlayheadMs,
    });
    // Deliberately runs once per mounted run id -- `initialPlayheadMs` is
    // read only as the starting point (deep link), not re-applied every
    // time it happens to change identity.
  }, [run.id]);

  const handleCopyLink = React.useCallback(async () => {
    const playheadMs = Math.round(useReplayStore.getState().playheadMs);
    const url = new URL(window.location.href);
    url.searchParams.set("t", String(playheadMs));
    await navigator.clipboard.writeText(url.toString());
    toast({ title: "Link copied", description: "Shares this exact moment in the replay." });
  }, []);

  const badge = RUN_STATUS_BADGE[run.status];

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <EmptyState
          icon={LayoutGrid}
          title="No graph to replay"
          description="This agent has no saved graph, so there's nothing to draw this run's trace onto."
          action={{ label: "Back to run history", onClick: () => window.history.back() }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-ink-400 px-4 py-3">
        <h1 className="text-title-sm text-fg-000">{agentName}</h1>
        <Badge variant={badge.variant}>{badge.label}</Badge>
        <span className="text-meta text-fg-100">via {run.trigger}</span>
        <span className="text-meta text-fg-200">{formatTimestamp(new Date(run.startedAt))}</span>
        <span className="text-meta text-fg-200">{formatDuration(run.durationMs)}</span>
        {run.errorMessage ? <span className="text-meta text-red-fg">{run.errorMessage}</span> : null}
        <div className="ml-auto flex items-center gap-2">
          <RunDiff
            agentId={agentId}
            workspaceSlug={workspaceSlug}
            currentRunId={run.id}
            currentSteps={currentSteps}
            availableRuns={availableRuns}
          />
          <Button variant="secondary" size="sm" onClick={handleCopyLink}>
            <LinkIcon className="size-3.5" aria-hidden="true" />
            Copy link to this moment
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <SplitPane
          id="trace-view-scrubber"
          orientation="vertical"
          defaultSize={520}
          min={280}
          max={900}
          handleLabel="Resize scrubber"
          primary={
            <div className="flex h-full w-full">
              <div className="min-w-0 flex-1">
                <ReactFlowProvider>
                  <ReplayCanvas graph={graph} />
                </ReactFlowProvider>
              </div>
              <NodeDetail nodes={graph.nodes} />
            </div>
          }
          secondary={<Scrubber onSelectNode={(nodeId) => useReplayStore.getState().setSelectedNodeId(nodeId)} />}
        />
      </div>
    </div>
  );
}
