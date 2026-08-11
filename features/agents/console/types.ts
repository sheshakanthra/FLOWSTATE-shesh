/** The console's own client-side view of a step, built up as NDJSON events
 *  arrive from `app/api/agents/[id]/run/route.ts` -- a superset of what
 *  gets recorded to `run_steps` (adds `streamedText`, which only exists
 *  transiently while an `llm_call` step is `running`). */
export interface ConsoleStep {
  nodeId: string;
  stepIndex: number;
  name: string;
  kind: string;
  status: "running" | "succeeded" | "failed" | "skipped";
  streamedText?: string;
  input?: unknown;
  output?: unknown;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  costCents?: number;
  durationMs?: number;
  errorMessage?: string;
}

export type RunPhase = "idle" | "running" | "succeeded" | "failed" | "cancelled";

export interface RunSummary {
  status: RunPhase;
  totalCostCents: number;
  totalDurationMs: number;
  finalOutputs: unknown[];
  errorMessage?: string;
}
