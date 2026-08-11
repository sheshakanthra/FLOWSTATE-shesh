"use client";

import { PackageOpen } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RunSummary } from "./types";

export interface OutputPanelProps {
  summary: RunSummary | null;
}

function formatOutput(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

/** The final result(s) of a run -- every Output-kind node the run actually
 *  reached (session spec item 4's "final output panel"). More than one
 *  entry is a real, expected case, not an edge case to collapse away: a
 *  branching graph can reach more than one Output node in a single run. */
export function OutputPanel({ summary }: OutputPanelProps) {
  if (!summary || summary.status === "idle") {
    return (
      <div className="flex h-full items-center justify-center text-meta text-fg-200">
        <PackageOpen className="mr-1.5 size-3.5" aria-hidden="true" />
        No output yet.
      </div>
    );
  }

  if (summary.status === "failed") {
    return (
      <div className="p-3 text-body text-red-fg">
        Run failed{summary.errorMessage ? `: ${summary.errorMessage}` : "."}
      </div>
    );
  }

  if (summary.status === "cancelled") {
    return <div className="p-3 text-body text-fg-100">Run cancelled.</div>;
  }

  if (summary.finalOutputs.length === 0) {
    return <div className="p-3 text-body text-fg-100">Run finished, but no Output node was reached.</div>;
  }

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="flex flex-col gap-2 p-3">
        {summary.finalOutputs.map((output, index) => (
          <pre
            key={index}
            className="overflow-x-auto rounded-md border border-ink-400 bg-ink-100 p-2.5 text-meta text-fg-000 font-mono whitespace-pre-wrap"
          >
            {formatOutput(output)}
          </pre>
        ))}
      </div>
    </ScrollArea>
  );
}
