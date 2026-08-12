import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getWorkspaceContext } from "@/lib/repos/workspaces";
import { getAgentDetail } from "@/lib/repos/agents";
import { getRunDetail, listRunSteps, listRuns } from "@/lib/repos/runs";
import { TraceView, type TraceGraph, type TraceRunSummary } from "@/features/agents/trace";
import type { AgentNode } from "@/features/agents/nodes/registry";
import type { TraceStepInput } from "@/features/agents/trace/playhead";

/**
 * Session spec item 2 + gate item 6 (deep link): the trace replay screen.
 * The graph replayed against is the agent's *current* `graph_jsonb` --
 * consistent with B4, where a run always executes the live draft, not a
 * versioned snapshot (there's no per-run graph snapshot to fall back to;
 * that's B6's versioning work). If the graph has since changed, a step
 * whose `nodeId` no longer exists just never lights up anything on canvas
 * -- TraceView's node-detail panel still shows every recorded step
 * regardless.
 *
 * `?t=<ms>` is the deep-link playhead position (gate item 6) -- read here,
 * server-side, and handed to TraceView as the starting point for
 * replay-store's playhead. There's no server-side validation of its range;
 * replay-store's own `setPlayhead`/`loadTrace` clamp it to
 * `[0, runDurationMs]` the same way an out-of-range value from any other
 * source would be.
 */
export default async function AgentRunTracePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; id: string; runId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { workspace: workspaceSlug, id: agentId, runId } = await params;
  const { t } = await searchParams;

  const session = await getSession();
  if (!session) redirect("/login");

  const context = await getWorkspaceContext(session.userId, workspaceSlug);
  if (!context) redirect("/login?no-workspace=1");

  const agent = await getAgentDetail(context.workspace.id, agentId);
  if (!agent) notFound();

  const run = await getRunDetail(context.workspace.id, runId);
  if (!run || run.agentId !== agentId) notFound();

  const [stepRows, allRuns] = await Promise.all([
    listRunSteps(context.workspace.id, runId),
    listRuns(context.workspace.id, agentId),
  ]);

  const graphPayload = agent.graph as { nodes: AgentNode[]; edges: TraceGraph["edges"] } | null;
  const graph: TraceGraph | null = graphPayload ? { nodes: graphPayload.nodes, edges: graphPayload.edges } : null;

  const steps: TraceStepInput[] = stepRows.map((step) => ({
    nodeId: step.nodeId,
    stepIndex: step.stepIndex,
    name: step.name,
    kind: step.kind,
    status: step.status as "succeeded" | "failed" | "skipped",
    startedAt: step.startedAt ? step.startedAt.toISOString() : null,
    finishedAt: step.finishedAt ? step.finishedAt.toISOString() : null,
    input: step.input,
    output: step.output,
    model: step.model ?? null,
    inputTokens: step.inputTokens ?? null,
    outputTokens: step.outputTokens ?? null,
    costCents: step.costCents ?? null,
    attempt: step.attempt,
    errorMessage: step.errorMessage ?? null,
  }));

  const runSummary: TraceRunSummary = {
    id: run.id,
    status: run.status,
    trigger: run.trigger,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
    durationMs: run.durationMs,
    costUsd: run.costUsd,
    inputTokens: run.inputTokens,
    outputTokens: run.outputTokens,
    errorMessage: run.errorMessage,
  };

  const availableRuns = allRuns.map((candidate) => ({
    id: candidate.id,
    startedAt: candidate.startedAt.toISOString(),
    status: candidate.status,
  }));

  const initialPlayheadMs = t ? Number.parseInt(t, 10) : 0;

  return (
    <TraceView
      agentId={agentId}
      agentName={agent.name}
      workspaceSlug={workspaceSlug}
      graph={graph}
      run={runSummary}
      steps={steps}
      availableRuns={availableRuns}
      initialPlayheadMs={Number.isFinite(initialPlayheadMs) ? Math.max(0, initialPlayheadMs) : 0}
    />
  );
}
