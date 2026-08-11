"use client";

import { CheckCircle2, CircleDashed, Loader2, MinusCircle, XCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ConsoleStep } from "./types";

const STATUS_ICON: Record<ConsoleStep["status"], typeof CheckCircle2> = {
  running: Loader2,
  succeeded: CheckCircle2,
  failed: XCircle,
  skipped: MinusCircle,
};

const STATUS_CLASS: Record<ConsoleStep["status"], string> = {
  running: "text-blue-fg animate-spin",
  succeeded: "text-emerald-fg",
  failed: "text-red-fg",
  skipped: "text-fg-200",
};

export interface StepLogProps {
  steps: ConsoleStep[];
}

/** Session spec item 4's "live step log streaming as execution proceeds" --
 *  a step appears the instant its `step-start` NDJSON event arrives (status
 *  `running`), an `llm_call` step's `streamedText` grows token by token as
 *  `token` events arrive, and the row settles into its final status on
 *  `step-end`. Every step this run has touched stays visible (nothing is
 *  removed or collapsed), including `skipped` ones, since gate item 5 needs
 *  a skipped dependent to be visibly, not just structurally, marked. */
export function StepLog({ steps }: StepLogProps) {
  if (steps.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-meta text-fg-200">
        <CircleDashed className="mr-1.5 size-3.5" aria-hidden="true" />
        Run the agent to see step-by-step progress here.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full min-h-0">
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
                {step.durationMs !== undefined ? (
                  <span className="ml-auto shrink-0 text-meta text-fg-200">{step.durationMs}ms</span>
                ) : null}
              </div>
              {step.streamedText ? (
                <p className="mt-1.5 whitespace-pre-wrap text-body text-fg-100">{step.streamedText}</p>
              ) : null}
              {step.status === "failed" && step.errorMessage ? (
                <div className="mt-1.5 rounded-sm border border-red-line bg-red-bg px-2 py-1.5 text-meta text-red-fg">
                  <p>{step.errorMessage}</p>
                  {step.input !== undefined ? (
                    <p className="mt-1 text-fg-100">Resolved input: {JSON.stringify(step.input)}</p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </ScrollArea>
  );
}
