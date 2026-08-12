"use client";

import type { ReactNode } from "react";
import { Coins, MousePointerClick, Timer } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { ResizablePanel } from "@/components/ui/resizable-panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getNodeType } from "../nodes/registry";
import { formatStepValue, nodeDetailAtTime, type NodeReplayStatus } from "./playhead";
import { useReplayStore } from "./replay-store";

export interface TraceGraphNode {
  id: string;
  type?: string;
  data: { label: string };
}

export interface NodeDetailProps {
  nodes: TraceGraphNode[];
}

const STATUS_BADGE: Record<NodeReplayStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: "Not yet run", variant: "neutral" },
  running: { label: "Running", variant: "blue" },
  succeeded: { label: "Succeeded", variant: "emerald" },
  failed: { label: "Failed", variant: "red" },
  skipped: { label: "Skipped", variant: "neutral" },
};

/**
 * The right-side panel for trace mode (session spec item 5) -- a sibling of
 * B3's edit-mode Inspector, not a repurposing of it: Inspector reads
 * graph-store/canvas-store and writes config through undo-registered
 * mutations, none of which apply to a read-only historical replay. What it
 * shows is deliberately time-gated by `nodeDetailAtTime` (playhead.ts): a
 * node clicked before its recorded start shows nothing but "not yet run",
 * never a preview of data that, at this instant in the replay, hasn't
 * happened yet (gate item 4).
 */
export function NodeDetail({ nodes }: NodeDetailProps) {
  const selectedNodeId = useReplayStore((state) => state.selectedNodeId);
  const steps = useReplayStore((state) => state.steps);
  const playheadMs = useReplayStore((state) => state.playheadMs);

  const node = nodes.find((candidate) => candidate.id === selectedNodeId);
  const definition = node?.type ? getNodeType(node.type) : undefined;
  const detail = selectedNodeId ? nodeDetailAtTime(steps, selectedNodeId, playheadMs) : null;

  let body: ReactNode;
  if (!selectedNodeId || !node) {
    body = (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-meta text-fg-200">
        <MousePointerClick className="size-5" aria-hidden="true" />
        Click a node on the canvas to see its state at the current playhead.
      </div>
    );
  } else {
    const status = detail!.status;
    const step = detail!.step;
    const badge = STATUS_BADGE[status];

    body = (
      <ScrollArea className="h-full min-h-0">
        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              {definition ? <definition.icon className="size-4 text-fg-200" aria-hidden="true" /> : null}
              <h3 className="text-label font-medium text-fg-000">{node.data.label}</h3>
            </div>
            <Badge variant={badge.variant} className="w-fit">
              {badge.label}
            </Badge>
          </div>

          {step ? (
            <>
              <div className="flex flex-wrap items-center gap-4 border-y border-ink-400/60 py-2 text-meta text-fg-100">
                <span className="flex items-center gap-1.5">
                  <Timer className="size-3.5" aria-hidden="true" />
                  {Math.max(0, step.endMs - step.startMs)}ms
                </span>
                {step.costCents !== null ? (
                  <span className="flex items-center gap-1.5">
                    <Coins className="size-3.5" aria-hidden="true" />
                    {step.costCents < 1 ? step.costCents.toFixed(4) : step.costCents.toFixed(2)}¢
                  </span>
                ) : null}
                {step.model ? <span>{step.model}</span> : null}
                {step.inputTokens !== null || step.outputTokens !== null ? (
                  <span>
                    {step.inputTokens ?? 0} in / {step.outputTokens ?? 0} out tokens
                  </span>
                ) : null}
              </div>

              {step.errorMessage ? (
                <div className="rounded-sm border border-red-line bg-red-bg px-2.5 py-2 text-meta text-red-fg">
                  {step.errorMessage}
                </div>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <h4 className="text-meta font-medium text-fg-100">Resolved input</h4>
                <pre className="overflow-x-auto rounded-md border border-ink-400 bg-ink-100 p-2.5 font-mono text-meta whitespace-pre-wrap text-fg-000">
                  {formatStepValue(step.input) || "—"}
                </pre>
              </div>

              {detail!.hasOutput ? (
                <div className="flex flex-col gap-1.5">
                  <h4 className="text-meta font-medium text-fg-100">Output</h4>
                  <pre className="overflow-x-auto rounded-md border border-ink-400 bg-ink-100 p-2.5 font-mono text-meta whitespace-pre-wrap text-fg-000">
                    {formatStepValue(step.output) || "—"}
                  </pre>
                </div>
              ) : null}

              {step.kind === "llm_call" ? (
                <Accordion type="single" collapsible>
                  <AccordionItem value="raw">
                    <AccordionTrigger className="text-meta">Provider request / response</AccordionTrigger>
                    <AccordionContent>
                      <p className="mb-2 text-meta text-fg-200">
                        What this run recorded for the model call — the resolved input sent and the output
                        received. The raw HTTP request/response was not persisted separately.
                      </p>
                      <pre className="overflow-x-auto rounded-md border border-ink-400 bg-ink-100 p-2.5 font-mono text-meta whitespace-pre-wrap text-fg-000">
                        {formatStepValue({ model: step.model, input: step.input, output: step.output })}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ) : null}
            </>
          ) : (
            <p className="text-body text-fg-100">This node hasn't run yet at the current playhead position.</p>
          )}
        </div>
      </ScrollArea>
    );
  }

  return (
    <ResizablePanel
      id="trace-node-detail"
      edge="right"
      defaultSize={320}
      min={260}
      max={480}
      handleLabel="Resize node detail panel"
      className="flex h-full flex-col border-l border-ink-400 bg-ink-100"
    >
      <div className="flex shrink-0 items-center border-b border-ink-400/60 px-4 py-3">
        <h2 className="text-label font-medium text-fg-000">Node detail</h2>
      </div>
      {body}
    </ResizablePanel>
  );
}
