import { desc, eq } from "drizzle-orm";
import { agentRuns, runSteps, type runStatusEnum, type runStepKindEnum, type runStepStatusEnum } from "@/db/schema";
import { withScope } from "./db";

export type RunStatus = (typeof runStatusEnum.enumValues)[number];
export type RunStepKind = (typeof runStepKindEnum.enumValues)[number];
export type RunStepStatus = (typeof runStepStatusEnum.enumValues)[number];

export interface RunRecord {
  id: string;
  workspaceId: string;
  agentId: string;
  status: RunStatus;
  startedAt: Date;
}

export async function createRun(workspaceId: string, agentId: string, trigger: string): Promise<RunRecord> {
  const [run] = await withScope({ workspaceId }, (tx) =>
    tx
      .insert(agentRuns)
      .values({ workspaceId, agentId, status: "running", trigger, startedAt: new Date() })
      .returning({ id: agentRuns.id, workspaceId: agentRuns.workspaceId, agentId: agentRuns.agentId, status: agentRuns.status, startedAt: agentRuns.startedAt }),
  );
  if (!run) throw new Error("run insert failed");
  return run;
}

export interface FinishRunPatch {
  status: Extract<RunStatus, "succeeded" | "failed" | "cancelled">;
  durationMs: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  errorMessage?: string;
}

export async function finishRun(workspaceId: string, runId: string, patch: FinishRunPatch): Promise<void> {
  await withScope({ workspaceId }, (tx) =>
    tx
      .update(agentRuns)
      .set({
        status: patch.status,
        finishedAt: new Date(),
        durationMs: patch.durationMs,
        costUsd: patch.costUsd.toFixed(4),
        inputTokens: patch.inputTokens,
        outputTokens: patch.outputTokens,
        errorMessage: patch.errorMessage ?? null,
      })
      .where(eq(agentRuns.id, runId)),
  );
}

/**
 * The record shape B5's replay depends on (session spec's own Notes: "if it
 * lacks resolved inputs or precise timestamps, replay will be approximate").
 * `input` is the node's *resolved* input -- {{token}} interpolation and
 * port-wired values already substituted, not raw config -- both so replay
 * can show exactly what a node saw and so gate item 5 ("shows the error
 * with the failing node's resolved input") has real data to surface.
 */
export interface StepEntry {
  nodeId: string;
  stepIndex: number;
  name: string;
  kind: RunStepKind;
  status: RunStepStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
  durationMs: number | null;
  input: unknown;
  output: unknown;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  costCents?: number;
  attempt?: number;
  errorMessage?: string;
}

export async function recordStep(workspaceId: string, runId: string, entry: StepEntry): Promise<void> {
  await withScope({ workspaceId }, (tx) =>
    tx.insert(runSteps).values({
      workspaceId,
      runId,
      nodeId: entry.nodeId,
      stepIndex: entry.stepIndex,
      name: entry.name,
      kind: entry.kind,
      status: entry.status,
      startedAt: entry.startedAt,
      finishedAt: entry.finishedAt,
      durationMs: entry.durationMs,
      input: entry.input,
      output: entry.output,
      model: entry.model ?? null,
      inputTokens: entry.inputTokens ?? null,
      outputTokens: entry.outputTokens ?? null,
      costCents: entry.costCents !== undefined ? entry.costCents.toFixed(6) : null,
      attempt: entry.attempt ?? 1,
      errorMessage: entry.errorMessage ?? null,
    }),
  );
}

export interface RunStepRecord extends Omit<StepEntry, "costCents"> {
  id: string;
  costCents: number | null;
}

/** Read back after a run for verification (gate item 2: "verified by
 *  querying the DB after a run, not by trusting the UI") and for B5's
 *  future replay -- ordered by `stepIndex`, the execution order the
 *  orchestrator assigned, not insertion order (which happens to be the
 *  same today, but callers shouldn't rely on that). */
export async function listRunSteps(workspaceId: string, runId: string): Promise<RunStepRecord[]> {
  const rows = await withScope({ workspaceId }, (tx) =>
    tx.select().from(runSteps).where(eq(runSteps.runId, runId)).orderBy(runSteps.stepIndex),
  );
  return rows.map((row) => ({
    id: row.id,
    nodeId: row.nodeId,
    stepIndex: row.stepIndex,
    name: row.name,
    kind: row.kind,
    status: row.status,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    durationMs: row.durationMs,
    input: row.input,
    output: row.output,
    model: row.model ?? undefined,
    inputTokens: row.inputTokens ?? undefined,
    outputTokens: row.outputTokens ?? undefined,
    costCents: row.costCents !== null ? Number(row.costCents) : null,
    attempt: row.attempt,
    errorMessage: row.errorMessage ?? undefined,
  }));
}

export async function getRun(workspaceId: string, runId: string): Promise<RunRecord | null> {
  const [run] = await withScope({ workspaceId }, (tx) =>
    tx
      .select({ id: agentRuns.id, workspaceId: agentRuns.workspaceId, agentId: agentRuns.agentId, status: agentRuns.status, startedAt: agentRuns.startedAt })
      .from(agentRuns)
      .where(eq(agentRuns.id, runId))
      .limit(1),
  );
  return run ?? null;
}

/**
 * Full run header -- everything B5's run history table and trace header
 * need (status/trigger/timing/cost/tokens/error), which `RunRecord` above
 * deliberately doesn't carry (it predates B5 and was scoped to exactly what
 * B4's route needed: id/workspaceId/agentId/status/startedAt). `costUsd`
 * comes back as a plain number, not the numeric column's string
 * representation -- every caller of this needs to do arithmetic with it
 * (the cost meter, the table's cost column), not just display it verbatim.
 */
export interface RunDetailRecord {
  id: string;
  workspaceId: string;
  agentId: string;
  status: RunStatus;
  trigger: string;
  startedAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
  costUsd: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  errorMessage: string | null;
}

function toRunDetail(row: typeof agentRuns.$inferSelect): RunDetailRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    agentId: row.agentId,
    status: row.status,
    trigger: row.trigger,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    durationMs: row.durationMs,
    costUsd: row.costUsd !== null ? Number(row.costUsd) : null,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    errorMessage: row.errorMessage,
  };
}

export async function getRunDetail(workspaceId: string, runId: string): Promise<RunDetailRecord | null> {
  const [run] = await withScope({ workspaceId }, (tx) =>
    tx.select().from(agentRuns).where(eq(agentRuns.id, runId)).limit(1),
  );
  return run ? toRunDetail(run) : null;
}

/** Every run for one agent, newest first -- the run history table's data
 *  source (session spec item 1). No pagination: seeded/demo scale here is
 *  tens of runs per agent, well within what DataTable's own virtualization
 *  (A5) already handles without a server-side paging protocol this session
 *  doesn't otherwise need. */
export async function listRuns(workspaceId: string, agentId: string): Promise<RunDetailRecord[]> {
  const rows = await withScope({ workspaceId }, (tx) =>
    tx.select().from(agentRuns).where(eq(agentRuns.agentId, agentId)).orderBy(desc(agentRuns.startedAt)),
  );
  return rows.map(toRunDetail);
}
