"use client";

import * as React from "react";
import { finish, start } from "@/components/firing-bar";
import { toast } from "@/components/ui/toast";
import { useGraphStore } from "../store/graph-store";
import { useRunStore } from "../store/run-store";
import { getNodeType } from "../nodes/registry";
import { InputForm } from "./input-form";
import { StepLog } from "./step-log";
import { OutputPanel } from "./output-panel";
import { CostSummary } from "./cost-summary";
import type { ConsoleStep, RunSummary } from "./types";

export interface TestConsoleProps {
  agentId: string;
  workspaceSlug: string;
}

interface RunStartEvent {
  type: "run-start";
  runId: string;
}
interface StepStartEvent {
  type: "step-start";
  nodeId: string;
  stepIndex: number;
  name: string;
  kind: string;
}
interface TokenEvent {
  type: "token";
  nodeId: string;
  delta: string;
}
interface StepEndEvent {
  type: "step-end";
  nodeId: string;
  stepIndex: number;
  name: string;
  kind: string;
  status: "succeeded" | "failed" | "skipped";
  output: unknown;
  input: unknown;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  costCents?: number;
  errorMessage?: string;
}
interface RunEndEvent {
  type: "run-end";
  status: "succeeded" | "failed" | "cancelled";
  totalCostCents: number;
  totalDurationMs: number;
  finalOutputs: unknown[];
  errorMessage?: string;
}
interface RunErrorEvent {
  type: "run-error";
  message: string;
}
type RunEvent = RunStartEvent | StepStartEvent | TokenEvent | StepEndEvent | RunEndEvent | RunErrorEvent;

/**
 * The bottom test console (session spec item 4) -- reads
 * `app/api/agents/[id]/run/route.ts`'s NDJSON stream directly via
 * `fetch()` + `response.body.getReader()` (no EventSource: this is a POST
 * with a body, which EventSource can't express), updating three things as
 * events arrive: this component's own `steps`/`summary` state (the log and
 * output panel), `useRunStore` (the canvas's live Shimmer/edge-pulse/
 * emerald/red feedback, gate item 5), and the FiringBar (gate item 8).
 */
export function TestConsole({ agentId, workspaceSlug }: TestConsoleProps) {
  const nodes = useGraphStore((state) => state.nodes);
  const triggerNode = React.useMemo(() => nodes.find((node) => node.type === "trigger"), [nodes]);
  const triggerDefinition = triggerNode?.type ? getNodeType(triggerNode.type) : undefined;

  const [phase, setPhase] = React.useState<"idle" | "running" | "done">("idle");
  const [steps, setSteps] = React.useState<ConsoleStep[]>([]);
  const [summary, setSummary] = React.useState<RunSummary | null>(null);

  const abortControllerRef = React.useRef<AbortController | null>(null);
  const firingIdRef = React.useRef<string | null>(null);

  const handleEvent = React.useCallback((event: RunEvent) => {
    if (event.type === "run-start") {
      useRunStore.getState().startRun(event.runId);
      return;
    }
    if (event.type === "step-start") {
      useRunStore.getState().setNodeStatus(event.nodeId, "running");
      setSteps((current) => [
        ...current,
        { nodeId: event.nodeId, stepIndex: event.stepIndex, name: event.name, kind: event.kind, status: "running" },
      ]);
      return;
    }
    if (event.type === "token") {
      setSteps((current) =>
        current.map((step) =>
          step.nodeId === event.nodeId ? { ...step, streamedText: (step.streamedText ?? "") + event.delta } : step,
        ),
      );
      return;
    }
    if (event.type === "step-end") {
      useRunStore.getState().setNodeStatus(event.nodeId, event.status);
      setSteps((current) =>
        current.map((step) =>
          step.nodeId === event.nodeId
            ? {
                ...step,
                status: event.status,
                input: event.input,
                output: event.output,
                model: event.model,
                inputTokens: event.inputTokens,
                outputTokens: event.outputTokens,
                costCents: event.costCents,
                errorMessage: event.errorMessage,
              }
            : step,
        ),
      );
      if (event.status === "failed") {
        toast({
          title: `${event.name} failed`,
          description: event.errorMessage ?? "See the step log for details.",
          variant: "danger",
        });
      }
      return;
    }
    if (event.type === "run-end") {
      setSummary({
        status: event.status,
        totalCostCents: event.totalCostCents,
        totalDurationMs: event.totalDurationMs,
        finalOutputs: event.finalOutputs,
        errorMessage: event.errorMessage,
      });
      return;
    }
    if (event.type === "run-error") {
      setSummary({ status: "failed", totalCostCents: 0, totalDurationMs: 0, finalOutputs: [], errorMessage: event.message });
      toast({ title: "Run failed", description: event.message, variant: "danger" });
    }
  }, []);

  const handleRun = React.useCallback(
    async (runInput: Record<string, unknown>) => {
      setPhase("running");
      setSteps([]);
      setSummary(null);
      useRunStore.getState().reset();

      const controller = new AbortController();
      abortControllerRef.current = controller;
      firingIdRef.current = start({ label: "Running agent…", initiator: "test-console" });

      let finalStatus: "succeeded" | "failed" | "cancelled" = "succeeded";
      try {
        const response = await fetch(`/api/agents/${agentId}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceSlug, runInput }),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          throw new Error(`Run request failed (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              handleEvent(JSON.parse(line) as RunEvent);
            } catch {
              // A malformed line shouldn't take down the whole reader loop.
            }
          }
        }
      } catch (error) {
        finalStatus = error instanceof Error && error.name === "AbortError" ? "cancelled" : "failed";
        if (finalStatus === "failed") {
          const message = error instanceof Error ? error.message : "The run failed unexpectedly.";
          setSummary((current) => current ?? { status: "failed", totalCostCents: 0, totalDurationMs: 0, finalOutputs: [], errorMessage: message });
        } else {
          setSummary((current) => current ?? { status: "cancelled", totalCostCents: 0, totalDurationMs: 0, finalOutputs: [] });
        }
      } finally {
        setPhase("done");
        useRunStore.getState().endRun();
        if (firingIdRef.current) {
          finish(firingIdRef.current, finalStatus === "succeeded" ? "success" : finalStatus === "cancelled" ? "cancelled" : "error");
        }
        abortControllerRef.current = null;
      }
    },
    [agentId, workspaceSlug, handleEvent],
  );

  const handleCancel = React.useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return (
    <div className="flex h-full min-h-0 divide-x divide-ink-400/60">
      <div className="w-64 shrink-0 overflow-y-auto p-3">
        <InputForm
          triggerDefinition={triggerDefinition}
          disabled={!triggerDefinition}
          onRun={handleRun}
          onCancel={handleCancel}
          isRunning={phase === "running"}
        />
      </div>
      <div className="min-w-0 flex-1">
        <StepLog steps={steps} />
      </div>
      <div className="flex w-72 shrink-0 flex-col">
        <div className="min-h-0 flex-1">
          <OutputPanel summary={summary} />
        </div>
        <CostSummary summary={summary} />
      </div>
    </div>
  );
}
