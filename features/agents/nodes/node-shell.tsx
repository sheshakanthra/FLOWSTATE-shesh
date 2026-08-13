"use client";

import * as React from "react";
import type { NodeProps } from "@xyflow/react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Shimmer } from "@/components/motion/shimmer";
import { useRunStore } from "../store/run-store";
import type { AgentNode, AnyNodeTypeDefinition } from "./registry";
import { Port } from "./port";

export interface NodeShellProps extends NodeProps<AgentNode> {
  definition: AnyNodeTypeDefinition;
}

/**
 * The one renderer for every registered node type -- a type file contributes
 * only data (ports, schema, summary), never a component, so registering a
 * new type can never mean writing bespoke render logic. See registry.ts's
 * `buildNodeTypes`, the only thing that wires a definition to this.
 *
 * Ports are absolutely-positioned overlays on the card's own edges (see
 * port.tsx), not a layout row, so card height stays constant regardless of
 * port count -- close to B1's GenericNode footprint, which the benchmark and
 * interaction e2e specs' hardcoded grid spacing and selection-box geometry
 * both assume.
 */
function NodeShellComponent({ id, data, selected, isConnectable, definition }: NodeShellProps) {
  // Render-count instrumentation for e2e/canvas-benchmark.spec.ts, carried
  // over unchanged from generic-node.tsx (see B1's decisions) -- proves gate
  // item 2 (zero re-renders on pan) without a human driving the Profiler.
  const renderCount = React.useRef(0);
  renderCount.current += 1;

  const configResult = definition.configSchema.safeParse(data.config);
  const isInvalid = !configResult.success;
  const isDisabled = data.disabled === true;
  const Icon = definition.icon;
  const summary = configResult.success ? definition.summary(configResult.data) : "Invalid configuration";

  // Only this node's own entry in the map is read -- a Zustand primitive
  // selector, so another node's status changing never re-renders this one.
  // See run-store.ts's own doc comment for why run feedback lives in its
  // own store rather than graph-store (B1's re-render-isolation precedent).
  const runStatus = useRunStore((state) => state.nodeStatuses[id]);

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
        <div className="ml-auto flex items-center gap-1.5">
          {isInvalid ? (
            <span title="Invalid configuration" className="flex items-center text-red-fg">
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Invalid configuration</span>
            </span>
          ) : null}
          {isDisabled ? <span className="text-meta text-fg-200">Disabled</span> : null}
        </div>
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
          isConnectable={isConnectable}
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
          isConnectable={isConnectable}
        />
      ))}
    </>
  );

  return (
    <div
      data-render-count={renderCount.current}
      data-node-type={definition.id}
      data-run-status={runStatus}
      aria-disabled={isDisabled || undefined}
      className={cn(
        // Fixed, not `min-w-44` (no upper bound) -- Tailwind's `truncate` on
        // the summary line below does nothing without a bounded parent
        // width to truncate against, so a long summary (a verbose LLM
        // system prompt, e.g.) silently grew the whole card instead of
        // eliding its own text, overlapping neighboring nodes at this
        // canvas's normal column spacing. Same real bug, same fix B5's
        // read-only replay node hit and fixed in its own file -- this
        // session's own template graphs are exactly the case that surfaces
        // it in the live builder too (see PROGRESS.md's B6 decisions).
        "relative flex w-44 flex-col rounded-lg border bg-ink-100 shadow-card",
        selected
          ? "border-blue-fg"
          : runStatus === "failed"
            ? "border-red-line"
            : runStatus === "succeeded"
              ? "border-emerald-line"
              : runStatus === "running"
                ? "border-blue-fg"
                : isInvalid
                  ? "border-red-line"
                  : "border-ink-400",
        (isDisabled || runStatus === "skipped") && "opacity-50",
      )}
    >
      {runStatus === "running" ? <Shimmer className="rounded-[inherit]">{content}</Shimmer> : content}
    </div>
  );
}

export const NodeShell = React.memo(NodeShellComponent);
NodeShell.displayName = "NodeShell";
