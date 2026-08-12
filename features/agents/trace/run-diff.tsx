"use client";

import * as React from "react";
import { GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatTimestamp } from "../lib/format";
import { formatStepValue, type NormalizedStep } from "./playhead";

export interface DiffEntry {
  nodeId: string;
  name: string;
  changed: boolean;
  before: string | null;
  after: string | null;
}

/**
 * Gate item 9: which nodes' outputs differ between two runs of the same
 * agent. Compared by node id (the stable link between a run_steps row and a
 * graph node), not by stepIndex -- two runs can skip different branches, so
 * the same node can land at a different stepIndex in each. A node missing
 * from one run (not reached, or added to the graph since) counts as
 * "changed" only if the other run actually produced output for it -- two
 * runs that both never reached a node aren't a meaningful difference.
 */
export function findChangedNodes(currentSteps: NormalizedStep[], compareSteps: NormalizedStep[]): DiffEntry[] {
  const byIdCurrent = new Map(currentSteps.map((step) => [step.nodeId, step]));
  const byIdCompare = new Map(compareSteps.map((step) => [step.nodeId, step]));
  const nodeIds = new Set([...byIdCurrent.keys(), ...byIdCompare.keys()]);

  const entries: DiffEntry[] = [];
  for (const nodeId of nodeIds) {
    const current = byIdCurrent.get(nodeId);
    const compare = byIdCompare.get(nodeId);
    const after = current && current.status === "succeeded" ? formatStepValue(current.output) : null;
    const before = compare && compare.status === "succeeded" ? formatStepValue(compare.output) : null;
    entries.push({
      nodeId,
      name: current?.name ?? compare?.name ?? nodeId,
      changed: before !== after,
      before,
      after,
    });
  }

  return entries.sort((a, b) => {
    const stepA = byIdCurrent.get(a.nodeId)?.stepIndex ?? byIdCompare.get(a.nodeId)?.stepIndex ?? 0;
    const stepB = byIdCurrent.get(b.nodeId)?.stepIndex ?? byIdCompare.get(b.nodeId)?.stepIndex ?? 0;
    return stepA - stepB;
  });
}

export interface DiffLine {
  type: "same" | "added" | "removed";
  text: string;
}

/** Basic line-level text diff (spec's own words: "basic text diff is
 *  sufficient") -- a standard LCS backtrack, no external dependency (no
 *  diff library is in CLAUDE.md's stack table). Good enough for the small,
 *  pretty-printed JSON blobs a node's output actually is. */
export function computeLineDiff(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));

  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      lines.push({ type: "same", text: a[i]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      lines.push({ type: "removed", text: a[i]! });
      i++;
    } else {
      lines.push({ type: "added", text: b[j]! });
      j++;
    }
  }
  while (i < a.length) {
    lines.push({ type: "removed", text: a[i]! });
    i++;
  }
  while (j < b.length) {
    lines.push({ type: "added", text: b[j]! });
    j++;
  }
  return lines;
}

const DIFF_LINE_CLASS: Record<DiffLine["type"], string> = {
  same: "text-fg-100",
  added: "bg-emerald-bg text-emerald-fg",
  removed: "bg-red-bg text-red-fg line-through decoration-red-fg/50",
};

export interface AvailableRun {
  id: string;
  startedAt: string;
  status: string;
}

export interface RunDiffProps {
  agentId: string;
  workspaceSlug: string;
  currentRunId: string;
  currentSteps: NormalizedStep[];
  availableRuns: AvailableRun[];
}

/** Gate item 9's UI: pick a second run of the same agent, fetch its trace
 *  via the same route the primary page used server-side (this is client
 *  code, comparing against a run that isn't the one the page loaded), and
 *  show which nodes' outputs changed. Lives inside a Dialog rather than a
 *  permanent panel -- comparison is an occasional, deliberate action, not
 *  something that needs screen real estate every time a trace is open. */
export function RunDiff({ agentId, workspaceSlug, currentRunId, currentSteps, availableRuns }: RunDiffProps) {
  const [compareRunId, setCompareRunId] = React.useState<string | null>(null);
  const [compareSteps, setCompareSteps] = React.useState<NormalizedStep[] | null>(null);
  const [status, setStatus] = React.useState<"idle" | "loading" | "error">("idle");

  async function handleSelectCompareRun(runId: string) {
    setCompareRunId(runId);
    setCompareSteps(null);
    setStatus("loading");
    try {
      const response = await fetch(
        `/api/agents/${agentId}/runs/${runId}/trace?workspaceSlug=${encodeURIComponent(workspaceSlug)}`,
      );
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as { steps: NormalizedStep[] };
      setCompareSteps(data.steps);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  const entries = compareSteps ? findChangedNodes(currentSteps, compareSteps) : [];
  const changedEntries = entries.filter((entry) => entry.changed);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <GitCompare className="size-3.5" aria-hidden="true" />
          Compare with another run
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compare runs</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Select value={compareRunId ?? undefined} onValueChange={handleSelectCompareRun}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a run to compare against" />
            </SelectTrigger>
            <SelectContent>
              {availableRuns
                .filter((run) => run.id !== currentRunId)
                .map((run) => (
                  <SelectItem key={run.id} value={run.id}>
                    {formatTimestamp(new Date(run.startedAt))} — {run.status}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          {status === "loading" ? <p className="text-meta text-fg-200">Loading…</p> : null}
          {status === "error" ? (
            <p className="text-meta text-red-fg">Couldn't load that run's trace. Try selecting it again.</p>
          ) : null}

          {compareSteps && status === "idle" ? (
            changedEntries.length === 0 ? (
              <p className="text-body text-fg-100">Every node's output matches between these two runs.</p>
            ) : (
              <ScrollArea className="max-h-96">
                <div className="flex flex-col gap-4 pr-2">
                  {changedEntries.map((entry) => (
                    <div key={entry.nodeId} className="flex flex-col gap-1.5">
                      <h4 className="text-meta font-medium text-fg-000">{entry.name}</h4>
                      <pre className="overflow-x-auto rounded-md border border-ink-400 bg-ink-100 p-2.5 font-mono text-meta whitespace-pre-wrap">
                        {computeLineDiff(entry.before ?? "", entry.after ?? "").map((line, index) => (
                          <div key={index} className={DIFF_LINE_CLASS[line.type]}>
                            {line.type === "added" ? "+ " : line.type === "removed" ? "- " : "  "}
                            {line.text || " "}
                          </div>
                        ))}
                      </pre>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
