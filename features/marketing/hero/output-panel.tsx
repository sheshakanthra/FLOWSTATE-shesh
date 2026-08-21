"use client";

import { CheckCircle2, CircleDashed, Loader2, MinusCircle, PackageOpen, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The hero's own step-log + result panel (E1 spec item 3: "streams the
 * result into an output panel with the same step log treatment as the
 * product's test console"). A sibling of `features/agents/console/step-log.tsx`
 * and `output-panel.tsx`, not an import of them -- this route has no
 * workspace/agent context, and CLAUDE.md's own rule is that a feature owns
 * its components until a second consumer promotes something shared and
 * business-logic-free into `components/ui`; the icon/status vocabulary below
 * is copied deliberately so the *treatment* matches pixel-for-pixel, not
 * because the two files needed to be the same module.
 */
export interface DemoStep {
  nodeId: string;
  name: string;
  kind: string;
  status: "running" | "succeeded" | "failed" | "skipped";
  streamedText?: string;
  errorMessage?: string;
}

export type DemoRunPhase = "idle" | "running" | "succeeded" | "failed";

export interface OutputPanelProps {
  steps: DemoStep[];
  finalOutput: string | null;
  phase: DemoRunPhase;
}

const STATUS_ICON: Record<DemoStep["status"], typeof CheckCircle2> = {
  running: Loader2,
  succeeded: CheckCircle2,
  failed: XCircle,
  skipped: MinusCircle,
};

const STATUS_CLASS: Record<DemoStep["status"], string> = {
  running: "text-blue-fg animate-spin",
  succeeded: "text-emerald-fg",
  failed: "text-red-fg",
  skipped: "text-fg-200",
};

export function OutputPanel({ steps, finalOutput, phase }: OutputPanelProps) {
  if (steps.length === 0) {
    return (
      <div className="flex h-full min-h-32 items-center justify-center gap-1.5 text-meta text-fg-200">
        <CircleDashed className="size-3.5" aria-hidden="true" />
        Waiting for the graph to finish building…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col divide-y divide-ink-400/60 overflow-y-auto">
      <ol className="flex flex-col gap-2 p-3" aria-label="Run step log">
        {steps.map((step) => {
          const Icon = STATUS_ICON[step.status];
          return (
            <li
              key={step.nodeId}
              className="rounded-md border border-ink-400 bg-ink-100 p-2.5"
              data-step-status={step.status}
            >
              <div className="flex items-center gap-2">
                <Icon className={cn("size-3.5 shrink-0", STATUS_CLASS[step.status])} aria-hidden="true" />
                <span className="truncate text-label font-medium text-fg-000">{step.name}</span>
                <span className="text-meta text-fg-200">{step.kind}</span>
              </div>
              {step.streamedText ? (
                <p className="mt-1.5 whitespace-pre-wrap text-body text-fg-100">{step.streamedText}</p>
              ) : null}
              {step.status === "failed" && step.errorMessage ? (
                <p className="mt-1.5 rounded-sm border border-red-line bg-red-bg px-2 py-1.5 text-meta text-red-fg">
                  {step.errorMessage}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="p-3">
        <h3 className="mb-2 text-label font-medium text-fg-100">Result</h3>
        {phase === "failed" ? (
          <p className="text-body text-red-fg">The run failed. See the step log above for details.</p>
        ) : finalOutput ? (
          <pre className="overflow-x-auto rounded-md border border-ink-400 bg-ink-100 p-2.5 text-meta text-fg-000 font-mono whitespace-pre-wrap">
            {finalOutput}
          </pre>
        ) : (
          <div className="flex items-center gap-1.5 text-meta text-fg-200">
            <PackageOpen className="size-3.5" aria-hidden="true" />
            Running…
          </div>
        )}
      </div>
    </div>
  );
}
