import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { getAgentDetail } from "@/lib/repos/agents";
import {
  createRun,
  finishRun,
  isRunCancellationRequested,
  recordStep,
  updateRunProgress,
  type StepEntry,
} from "@/lib/repos/runs";
import { syncAgentPriorityItems } from "@/lib/repos/priorities";
import { getVersion } from "@/lib/repos/agent-versions";
import { runGraph, type EngineNode } from "@/features/agents/engine/executor";
import type { EngineGraphEdge } from "@/features/agents/engine/scope-resolver";

const runRequestSchema = z.object({
  workspaceSlug: z.string().min(1),
  runInput: z.unknown().optional(),
  // B6 gate item 2 ("draft isolation"): omitted, this runs the live draft,
  // identical to B4's original behavior -- every existing caller (the test
  // console) never sends this field. Set to a real `agent_versions` id,
  // this runs that immutable snapshot instead, which is what this
  // session's own draft-isolation test/e2e exercise directly: start a run
  // pinned to a published version, edit the draft while it's mid-run, and
  // confirm the run's recorded steps reflect the version's original graph,
  // not the edit. Not exposed in the builder UI this session -- the spec's
  // own version-panel actions (item 3) are View/Diff/Restore, not Run.
  agentVersionId: z.string().optional(),
});

/** One NDJSON line per event -- newline-delimited JSON, not SSE: the
 *  client is a `fetch()` POST with a body (the run input), which
 *  `EventSource` can't express (GET-only, no body), and NDJSON needs no
 *  new dependency (no `ai`/`eventsource` package in CLAUDE.md's table) on
 *  either side -- the client reads `response.body.getReader()` and splits
 *  on `\n`, matching this file's own framing exactly. */
type RunEvent =
  | { type: "run-start"; runId: string }
  | { type: "step-start"; nodeId: string; stepIndex: number; name: string; kind: string }
  | { type: "token"; nodeId: string; delta: string }
  | {
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
  | { type: "run-end"; status: "succeeded" | "failed" | "cancelled"; totalCostCents: number; totalDurationMs: number; finalOutputs: unknown[]; errorMessage?: string }
  | { type: "run-error"; message: string };

/**
 * Streams a real execution of `agents.graph_jsonb` (the live-editing draft
 * -- see B3's decisions on why there's no other "current graph" to read
 * from) through `features/agents/engine/executor.ts`, recording every step
 * to `run_steps` as it completes (gate item 2) and forwarding progress as
 * NDJSON so the test console can render a live log (gate item 4) and the
 * canvas can show live per-node feedback (gate item 5) without polling.
 *
 * Cancellation (B4 gate item 6, same-tab): `request.signal` fires when the
 * client's own `fetch()` is aborted (the console's Cancel button), and
 * that's threaded into `cancelController` below alongside D2's own channel.
 *
 * D2 gate item 4 adds cross-tab cancellation: the in-flight zone's Cancel
 * button lives on an entirely different request (Today's page, not this
 * one), so it can't touch `request.signal` at all -- the same shape of
 * problem C2 hit for the copilot's Stop button, and the same fix: a
 * `cancel_requested` column on `agent_runs` (see its own schema doc
 * comment) that `POST /api/agents/[id]/run/[runId]/cancel` sets and this
 * route polls, both through the same real Postgres connection rather than
 * Node module state. Both cancellation sources feed one local
 * `cancelController`, so `runGraph` only ever has to know about a single
 * `AbortSignal`.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: agentId } = await params;

  const parsed = runRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const context = await requireRole(request, parsed.data.workspaceSlug, "member");
  if (context instanceof Response) return context;

  const workspaceId = context.workspace.id;

  let graph: { nodes: EngineNode[]; edges: EngineGraphEdge[] } | null;
  if (parsed.data.agentVersionId) {
    const version = await getVersion(workspaceId, agentId, parsed.data.agentVersionId);
    if (!version) {
      return Response.json({ error: "Version not found." }, { status: 404 });
    }
    graph = version.graph as unknown as { nodes: EngineNode[]; edges: EngineGraphEdge[] };
  } else {
    const agent = await getAgentDetail(workspaceId, agentId);
    if (!agent) {
      return Response.json({ error: "Agent not found." }, { status: 404 });
    }
    graph = agent.graph as { nodes: EngineNode[]; edges: EngineGraphEdge[] } | null;
  }
  if (!graph || graph.nodes.length === 0) {
    return Response.json({ error: "This agent has no graph to run yet." }, { status: 400 });
  }

  const run = await createRun(workspaceId, agentId, "manual", parsed.data.agentVersionId);
  const runStartedAt = Date.now();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: RunEvent) {
        // A client-initiated cancel (gate item 6) tears down the response
        // stream from the reading side before the server-side run loop has
        // necessarily noticed the abort -- the DB writes below are what
        // actually matter once that's happened, so a closed-controller
        // enqueue failure here is expected, not a bug to propagate.
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // ignore
        }
      }

      // D2 gate item 4: a single local AbortController both cancellation
      // sources feed -- request.signal (same-tab) via a listener, and the
      // in-flight zone's cross-tab request via this poll loop, throttled
      // the same way C2's copilot-stream cancellation is (frequent enough
      // to clear the 500ms budget with room to spare, far less often than
      // a Postgres round trip is free).
      const cancelController = new AbortController();
      request.signal.addEventListener("abort", () => cancelController.abort());
      const cancelPollInterval = setInterval(() => {
        void isRunCancellationRequested(workspaceId, run.id).then((requested) => {
          if (requested) cancelController.abort();
        });
      }, 150);

      send({ type: "run-start", runId: run.id });

      try {
        const result = await runGraph({
          nodes: graph.nodes,
          edges: graph.edges,
          runInput: parsed.data.runInput,
          signal: cancelController.signal,
          onStepStart: (event) => {
            send({ type: "step-start", nodeId: event.nodeId, stepIndex: event.stepIndex, name: event.name, kind: event.kind });
            // D2 scope item 1: what the in-flight card's "current node"
            // reads. Best-effort -- a write failing here shouldn't stall
            // or fail a run that's otherwise progressing normally.
            void updateRunProgress(workspaceId, run.id, event.name, event.stepIndex).catch(() => {});
          },
          onToken: (nodeId, delta) => {
            send({ type: "token", nodeId, delta });
          },
          onStepEnd: async (event) => {
            send({
              type: "step-end",
              nodeId: event.nodeId,
              stepIndex: event.stepIndex,
              name: event.name,
              kind: event.kind,
              status: event.status,
              output: event.output,
              input: event.input,
              model: event.model,
              inputTokens: event.inputTokens,
              outputTokens: event.outputTokens,
              costCents: event.costCents,
              errorMessage: event.errorMessage,
            });
            const entry: StepEntry = {
              nodeId: event.nodeId,
              stepIndex: event.stepIndex,
              name: event.name,
              kind: event.kind,
              status: event.status,
              startedAt: event.startedAt,
              finishedAt: event.finishedAt,
              durationMs: event.durationMs,
              input: event.input,
              output: event.output,
              model: event.model,
              inputTokens: event.inputTokens,
              outputTokens: event.outputTokens,
              costCents: event.costCents,
              attempt: event.attempt,
              errorMessage: event.errorMessage,
            };
            await recordStep(workspaceId, run.id, entry);
          },
        });

        const totalDurationMs = Date.now() - runStartedAt;
        await finishRun(workspaceId, run.id, {
          status: result.status,
          durationMs: totalDurationMs,
          costUsd: result.totalCostCents / 100,
          inputTokens: result.totalInputTokens,
          outputTokens: result.totalOutputTokens,
          errorMessage: result.errorMessage,
        });
        // D1: the real "materialize on event" hook -- a run finishing
        // (success or failure) is the trigger, not the Today page's own
        // render. See lib/repos/priorities.ts#syncAgentPriorityItems for
        // what it derives from this agent's now-updated run history.
        // Best-effort: a sync failure shouldn't fail the run response the
        // client is waiting on.
        await syncAgentPriorityItems(workspaceId, agentId).catch(() => {});

        send({
          type: "run-end",
          status: result.status,
          totalCostCents: result.totalCostCents,
          totalDurationMs,
          finalOutputs: result.finalOutputs,
          errorMessage: result.errorMessage,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "The run failed unexpectedly.";
        const totalDurationMs = Date.now() - runStartedAt;
        await finishRun(workspaceId, run.id, {
          status: "failed",
          durationMs: totalDurationMs,
          costUsd: 0,
          inputTokens: 0,
          outputTokens: 0,
          errorMessage: message,
        });
        await syncAgentPriorityItems(workspaceId, agentId).catch(() => {});
        send({ type: "run-error", message });
      } finally {
        clearInterval(cancelPollInterval);
        try {
          controller.close();
        } catch {
          // Already closed by the reading side disconnecting -- fine.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
