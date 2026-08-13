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
import { cn } from "@/lib/utils";
import { listNodeTypes, type AgentNode, type AnyNodeTypeDefinition } from "../nodes/registry";
import { Port } from "../nodes/port";
import { CanvasBackground } from "../canvas/background";
import { FIT_VIEW_PADDING } from "../lib/viewport";

export type NodeDiffStatus = "added" | "removed" | "modified" | "unchanged";

export interface PropertyChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface NodeDiffEntry {
  nodeId: string;
  status: NodeDiffStatus;
  label: string;
  changes: PropertyChange[];
}

interface DiffableNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: { label: string; config: Record<string, unknown> };
}
interface DiffableEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}
export interface DiffableGraph {
  nodes: DiffableNode[];
  edges: DiffableEdge[];
}

function shallowEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Session spec item 4: "added nodes emerald, removed red, modified amber."
 * `base` is the historical version being viewed, `compare` is always the
 * current draft (`agents.graph_jsonb`) -- the versions panel's own action is
 * literally named "diff against current" (item 3), not an arbitrary
 * version-vs-version picker, so that direction is fixed, not a parameter a
 * caller can get backwards. A node present in both with identical label and
 * config is `"unchanged"` and gets no entry in the side list, but is still
 * returned (as `"unchanged"`) so the canvas can render it plainly rather
 * than needing a second lookup to know "not mentioned = unchanged."
 */
export function diffGraphs(base: DiffableGraph, compare: DiffableGraph): NodeDiffEntry[] {
  const baseById = new Map(base.nodes.map((node) => [node.id, node]));
  const compareById = new Map(compare.nodes.map((node) => [node.id, node]));
  const allIds = new Set([...baseById.keys(), ...compareById.keys()]);

  const entries: NodeDiffEntry[] = [];
  for (const nodeId of allIds) {
    const inBase = baseById.get(nodeId);
    const inCompare = compareById.get(nodeId);

    if (inCompare && !inBase) {
      entries.push({ nodeId, status: "added", label: inCompare.data.label, changes: [] });
      continue;
    }
    if (inBase && !inCompare) {
      entries.push({ nodeId, status: "removed", label: inBase.data.label, changes: [] });
      continue;
    }
    if (!inBase || !inCompare) continue; // unreachable, satisfies narrowing

    const changes: PropertyChange[] = [];
    if (inBase.data.label !== inCompare.data.label) {
      changes.push({ field: "label", before: inBase.data.label, after: inCompare.data.label });
    }
    const keys = new Set([...Object.keys(inBase.data.config), ...Object.keys(inCompare.data.config)]);
    for (const key of keys) {
      const beforeValue = inBase.data.config[key];
      const afterValue = inCompare.data.config[key];
      if (!shallowEqual(beforeValue, afterValue)) {
        changes.push({ field: key, before: beforeValue, after: afterValue });
      }
    }

    entries.push({
      nodeId,
      status: changes.length > 0 ? "modified" : "unchanged",
      label: inCompare.data.label,
      changes,
    });
  }

  return entries;
}

const DIFF_BORDER: Record<NodeDiffStatus, string> = {
  added: "border-emerald-line",
  removed: "border-red-line border-dashed",
  modified: "border-amber-line",
  unchanged: "border-ink-400",
};

interface DiffNodeProps extends NodeProps<AgentNode> {
  definition: AnyNodeTypeDefinition;
  status: NodeDiffStatus;
}

function DiffNodeComponent({ id, data, definition, status }: DiffNodeProps) {
  const configResult = definition.configSchema.safeParse(data.config);
  const summary = configResult.success ? definition.summary(configResult.data) : "Invalid configuration";
  const Icon = definition.icon;

  return (
    <div
      className={cn(
        "relative flex w-44 flex-col rounded-lg border bg-ink-100 shadow-card",
        DIFF_BORDER[status],
        status === "removed" && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <div aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-ink-200 text-fg-200">
          <Icon className="size-3.5" />
        </div>
        <span className="truncate text-label text-fg-000">{data.label}</span>
      </div>
      <div className="truncate border-t border-ink-400/60 px-3 py-1.5 text-meta text-fg-100">{summary}</div>
      {definition.inputs.map((port, index) => (
        <Port key={port.id} nodeId={id} port={port} direction="input" index={index} total={definition.inputs.length} isConnectable={false} />
      ))}
      {definition.outputs.map((port, index) => (
        <Port key={port.id} nodeId={id} port={port} direction="output" index={index} total={definition.outputs.length} isConnectable={false} />
      ))}
    </div>
  );
}

function buildDiffNodeTypes(statusByNodeId: Map<string, NodeDiffStatus>): NodeTypes {
  const map: NodeTypes = {};
  for (const definition of listNodeTypes()) {
    const Component = (props: NodeProps<AgentNode>) => (
      <DiffNodeComponent {...props} definition={definition} status={statusByNodeId.get(props.id) ?? "unchanged"} />
    );
    Component.displayName = `DiffNode(${definition.id})`;
    map[definition.id] = Component;
  }
  return map;
}

function DiffEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  return <BaseEdge path={path} style={style} markerEnd={markerEnd} />;
}
const diffEdgeTypes: EdgeTypes = { default: DiffEdge };

export interface VersionDiffProps {
  base: DiffableGraph;
  compare: DiffableGraph;
}

/** The canvas half of gate item 3/4 -- a read-only canvas (its own
 *  `ReactFlowProvider`, same "never touch the live builder's stores"
 *  reasoning B5's replay canvas documented) unioning both graphs' nodes so
 *  a removed node still has somewhere to render (at its old position, from
 *  `base`), plus the side list of changed properties for modified nodes. */
export function VersionDiff({ base, compare }: VersionDiffProps) {
  const entries = React.useMemo(() => diffGraphs(base, compare), [base, compare]);
  const statusByNodeId = React.useMemo(() => new Map(entries.map((entry) => [entry.nodeId, entry.status])), [entries]);
  const nodeTypes = React.useMemo(() => buildDiffNodeTypes(statusByNodeId), [statusByNodeId]);

  const baseById = new Map(base.nodes.map((node) => [node.id, node]));
  const compareById = new Map(compare.nodes.map((node) => [node.id, node]));
  const unionNodes: AgentNode[] = entries.map((entry) => {
    const source = compareById.get(entry.nodeId) ?? baseById.get(entry.nodeId)!;
    return {
      id: entry.nodeId,
      type: source.type,
      position: source.position,
      data: { label: source.data.label, config: source.data.config },
    };
  });
  const edgeById = new Map<string, DiffableEdge>();
  for (const edge of [...base.edges, ...compare.edges]) edgeById.set(edge.id, edge);
  const unionEdges = Array.from(edgeById.values()).filter(
    (edge) => statusByNodeId.has(edge.source) && statusByNodeId.has(edge.target),
  );

  const changedEntries = entries.filter((entry) => entry.status !== "unchanged");

  return (
    <div className="flex h-full w-full">
      <div className="min-w-0 flex-1">
        <ReactFlowProvider>
          <ReactFlow
            nodes={unionNodes}
            edges={unionEdges}
            nodeTypes={nodeTypes}
            edgeTypes={diffEdgeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            fitView
            fitViewOptions={{ padding: FIT_VIEW_PADDING }}
            proOptions={{ hideAttribution: true }}
          >
            <CanvasBackground />
          </ReactFlow>
        </ReactFlowProvider>
      </div>

      <div className="w-72 shrink-0 overflow-y-auto border-l border-ink-400 bg-ink-100 p-3">
        <h3 className="mb-2 text-meta font-medium text-fg-100 uppercase tracking-wide">Changes</h3>
        {changedEntries.length === 0 ? (
          <p className="text-meta text-fg-200">No differences from the current draft.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {changedEntries.map((entry) => (
              <li key={entry.nodeId} className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      entry.status === "added" && "bg-emerald-fg",
                      entry.status === "removed" && "bg-red-fg",
                      entry.status === "modified" && "bg-amber-fg",
                    )}
                    aria-hidden="true"
                  />
                  <span className="text-label font-medium text-fg-000">{entry.label}</span>
                  <span className="text-meta text-fg-200">{entry.status}</span>
                </div>
                {entry.changes.length > 0 ? (
                  <ul className="ml-3.5 flex flex-col gap-0.5">
                    {entry.changes.map((change) => (
                      <li key={change.field} className="text-meta text-fg-100">
                        <span className="text-fg-200">{change.field}:</span> {String(change.before ?? "—")} →{" "}
                        {String(change.after ?? "—")}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** The panel's plain "View" action (item 3) -- a single version's graph,
 *  read-only, no comparison. Shares `DiffNodeComponent`/`buildDiffNodeTypes`
 *  with an empty status map (every node defaults to `"unchanged"`, a
 *  neutral border) rather than duplicating the node/edge renderer for what
 *  would otherwise be a near-identical file. */
export function VersionView({ graph }: { graph: DiffableGraph }) {
  const nodeTypes = React.useMemo(() => buildDiffNodeTypes(new Map()), []);
  const nodes: AgentNode[] = graph.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: { label: node.data.label, config: node.data.config },
  }));

  return (
    <div className="h-full w-full">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          edgeTypes={diffEdgeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          fitView
          fitViewOptions={{ padding: FIT_VIEW_PADDING }}
          proOptions={{ hideAttribution: true }}
        >
          <CanvasBackground />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
