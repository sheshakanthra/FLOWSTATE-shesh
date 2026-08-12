/**
 * Pure timeline math for trace replay -- framework-free (no React, no
 * Zustand, no @xyflow/react) so it's directly unit-testable against
 * synthetic run_steps fixtures, matching B4's engine-testing precedent
 * (executor.test.ts, condition.test.ts: zero DB, zero browser). This is the
 * one file gate item 1's "frame accuracy" automated test targets.
 *
 * Everything here is a pure function of `(steps, playheadMs)` -- nothing
 * here holds state. replay-store.ts is the only place that calls these and
 * caches the result, per the session spec's own note: "derive all node
 * states from [the playhead], memoized."
 */

export type NodeReplayStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";

/** The wire shape a trace step arrives in (from the trace API route, or a
 *  test fixture) -- timestamps are ISO strings or null, matching how a
 *  run_steps row serializes over JSON. */
export interface TraceStepInput {
  nodeId: string;
  stepIndex: number;
  name: string;
  kind: string;
  status: "succeeded" | "failed" | "skipped";
  startedAt: string | null;
  finishedAt: string | null;
  input: unknown;
  output: unknown;
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  costCents?: number | null;
  attempt?: number;
  errorMessage?: string | null;
}

/** A step with wall-clock time resolved to milliseconds since the run
 *  started -- every step has a real startMs/endMs after normalization, even
 *  a skipped one (see normalizeSteps below), so every derivation past this
 *  point can do plain number comparisons. */
export interface NormalizedStep {
  nodeId: string;
  stepIndex: number;
  name: string;
  kind: string;
  status: "succeeded" | "failed" | "skipped";
  startMs: number;
  endMs: number;
  input: unknown;
  output: unknown;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costCents: number | null;
  attempt: number;
  errorMessage: string | null;
}

export interface NormalizedEdge {
  id: string;
  source: string;
  target: string;
}

/**
 * Resolves every step's real start/end offset from the run's start time. A
 * skipped step never ran, so the engine records no timestamps for it at all
 * (executor.ts's shouldSkip branch) -- there's no wall-clock instant to
 * anchor it to, so one is synthesized: the point execution had logically
 * reached by stepIndex order, i.e. right where the previous step (in
 * execution order) left off. That's not a guess about *when* the skip
 * "happened" (skips are instantaneous, there's no real duration to recover)
 * -- it's what makes a skipped node land in its correct place on the
 * timeline instead of collapsing to t=0 regardless of where in the run it
 * actually occurred.
 */
export function normalizeSteps(steps: TraceStepInput[], runStartedAt: string): NormalizedStep[] {
  const runStartMs = new Date(runStartedAt).getTime();
  const sorted = [...steps].sort((a, b) => a.stepIndex - b.stepIndex);

  const normalized: NormalizedStep[] = [];
  let cursorMs = 0;

  for (const step of sorted) {
    let startMs: number;
    let endMs: number;

    if (step.startedAt) {
      startMs = new Date(step.startedAt).getTime() - runStartMs;
      endMs = step.finishedAt ? new Date(step.finishedAt).getTime() - runStartMs : startMs;
    } else {
      startMs = cursorMs;
      endMs = cursorMs;
    }

    cursorMs = Math.max(cursorMs, endMs);

    normalized.push({
      nodeId: step.nodeId,
      stepIndex: step.stepIndex,
      name: step.name,
      kind: step.kind,
      status: step.status,
      startMs,
      endMs,
      input: step.input,
      output: step.output,
      model: step.model ?? null,
      inputTokens: step.inputTokens ?? null,
      outputTokens: step.outputTokens ?? null,
      costCents: step.costCents ?? null,
      attempt: step.attempt ?? 1,
      errorMessage: step.errorMessage ?? null,
    });
  }

  return normalized;
}

/** The full run duration a scrubber should span -- the recorded run
 *  duration, or the last step's end time if that somehow runs later (fixture
 *  data isn't always perfectly self-consistent; real recorded runs always
 *  satisfy `lastStepEnd <= runDurationMs` by construction, but nothing here
 *  should silently clip a step off the end of the track if it doesn't). */
export function effectiveRunDurationMs(steps: NormalizedStep[], recordedDurationMs: number): number {
  const lastStepEnd = steps.reduce((max, step) => Math.max(max, step.endMs), 0);
  return Math.max(recordedDurationMs, lastStepEnd);
}

/**
 * A node's replay status at a given instant. Frame-accurate, not just
 * "final status once the run ends": before a step's recorded start, the
 * node is `pending`; between start and end it's `running` regardless of
 * what its *final* recorded status turned out to be (the whole point of
 * scrubbing is seeing what was true *then*, not the eventual outcome);
 * from its end onward it's the real recorded outcome.
 */
export function deriveNodeStatesAtTime(steps: NormalizedStep[], playheadMs: number): Map<string, NodeReplayStatus> {
  const states = new Map<string, NodeReplayStatus>();
  for (const step of steps) {
    let status: NodeReplayStatus;
    if (playheadMs < step.startMs) status = "pending";
    else if (playheadMs < step.endMs) status = "running";
    else status = step.status;
    states.set(step.nodeId, status);
  }
  return states;
}

/**
 * An edge is "carrying a payload" in the window between its source
 * finishing and its target starting -- the actual transit gap, not simply
 * "source is running" (B4's live RunEdge convention, which doesn't apply
 * here: replay steps don't have a live "running" *phase* on the wire, only
 * recorded start/end instants). A target that was skipped never received
 * anything, so its incoming edges never light up regardless of playhead.
 */
export function deriveActiveEdgeIds(edges: NormalizedEdge[], steps: NormalizedStep[], playheadMs: number): Set<string> {
  const byNode = new Map(steps.map((step) => [step.nodeId, step]));
  const active = new Set<string>();
  for (const edge of edges) {
    const source = byNode.get(edge.source);
    const target = byNode.get(edge.target);
    if (!source || !target || target.status === "skipped") continue;
    if (playheadMs >= source.endMs && playheadMs < target.startMs) active.add(edge.id);
  }
  return active;
}

/**
 * Cost accumulated up to the playhead. Snaps to `finalTotalCostCents`
 * exactly once the playhead reaches the end of the run (gate item 5: "cost
 * meter total at the end of replay equals the run's recorded total
 * exactly") rather than trusting a re-summed-from-steps total to land on
 * the same float as the run's own authoritative recorded figure -- per-step
 * costs are rounded to 6 decimal places on the way into the database
 * (db/schema.ts's run_steps.cost_cents), so re-summing the rounded values
 * back out is not guaranteed to reproduce the unrounded total the engine
 * accumulated in memory and wrote to `agent_runs.cost_usd`. Before the end,
 * the partial sum is exactly that -- a real partial sum of real recorded
 * per-step costs, not an interpolation.
 */
export function deriveCostCentsAtTime(
  steps: NormalizedStep[],
  playheadMs: number,
  runDurationMs: number,
  finalTotalCostCents: number,
): number {
  if (playheadMs >= runDurationMs) return finalTotalCostCents;
  let total = 0;
  for (const step of steps) {
    if (step.costCents !== null && playheadMs >= step.endMs) total += step.costCents;
  }
  return total;
}

/** A node's detail as of the playhead -- `step` is null (not "the final
 *  step, just not shown yet") until the node has actually started, so a
 *  consumer can never accidentally read ahead into data that, at this point
 *  in the replay, hasn't happened yet (gate item 4: "shows the resolved
 *  input at that moment, not the final input"). `hasOutput` only turns true
 *  once the step has actually finished successfully -- a still-`running`
 *  step has a known (already-resolved) input but no output yet. */
export interface NodeDetailAtTime {
  status: NodeReplayStatus;
  step: NormalizedStep | null;
  hasOutput: boolean;
}

export function nodeDetailAtTime(steps: NormalizedStep[], nodeId: string, playheadMs: number): NodeDetailAtTime {
  const step = steps.find((candidate) => candidate.nodeId === nodeId);
  if (!step || playheadMs < step.startMs) return { status: "pending", step: null, hasOutput: false };
  if (playheadMs < step.endMs) return { status: "running", step, hasOutput: false };
  return { status: step.status, step, hasOutput: step.status === "succeeded" };
}

/** Every distinct instant something happened, deduplicated and sorted --
 *  0 and the run's end are always included so stepping never gets stuck
 *  short of either boundary on a run with very few steps. */
export function eventTimes(steps: NormalizedStep[], runDurationMs: number): number[] {
  const times = new Set<number>([0, runDurationMs]);
  for (const step of steps) {
    times.add(step.startMs);
    times.add(step.endMs);
  }
  return Array.from(times).sort((a, b) => a - b);
}

/** Gate item 7: arrow-key stepping moves to the next/previous *event*, not
 *  a fixed time delta, so it always lands exactly on a state change. */
export function nextEventTime(steps: NormalizedStep[], currentMs: number, runDurationMs: number): number {
  const times = eventTimes(steps, runDurationMs);
  return times.find((time) => time > currentMs) ?? runDurationMs;
}

export function previousEventTime(steps: NormalizedStep[], currentMs: number, runDurationMs: number): number {
  const times = eventTimes(steps, runDurationMs);
  let result = 0;
  for (const time of times) {
    if (time >= currentMs) break;
    result = time;
  }
  return result;
}

/** Shared with node-detail.tsx and run-diff.tsx -- the same "pretty JSON
 *  unless it's already a plain string" formatting OutputPanel (B4) uses. */
export function formatStepValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}
