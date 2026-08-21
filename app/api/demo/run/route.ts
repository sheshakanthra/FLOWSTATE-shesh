import { z } from "zod";
import { runGraph, type EngineNode } from "@/features/agents/engine/executor";
import type { EngineGraphEdge } from "@/features/agents/engine/scope-resolver";
import { getClientIp, isDemoRateLimited } from "@/lib/rate-limit";

const nodeSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  data: z.object({
    label: z.string(),
    config: z.record(z.string(), z.unknown()),
    disabled: z.boolean().optional(),
  }),
});

const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
});

// A real generated plan is capped at 8 steps (generate-from-description.ts)
// plus at most a handful of auto-inserted bridge nodes -- these ceilings
// give that comfortable room while still bounding what an unauthenticated,
// public endpoint will hand to a real, billed LLM call.
const requestSchema = z.object({
  nodes: z.array(nodeSchema).min(1).max(16),
  edges: z.array(edgeSchema).max(32),
  runInput: z.string().max(2000).optional(),
});

const RUN_TIMEOUT_MS = 30_000;

function combineSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const controller = new AbortController();
  if (a.aborted || b.aborted) {
    controller.abort();
  } else {
    a.addEventListener("abort", () => controller.abort(), { once: true });
    b.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}

type DemoRunEvent =
  | { type: "step-start"; nodeId: string; name: string; kind: string }
  | { type: "token"; nodeId: string; delta: string }
  | { type: "step-end"; nodeId: string; name: string; kind: string; status: "succeeded" | "failed" | "skipped"; output: unknown; errorMessage?: string }
  | { type: "run-end"; status: "succeeded" | "failed" | "cancelled"; finalOutputs: unknown[]; errorMessage?: string };

/**
 * Runs the hero's freshly generated (or fallback) graph for real -- the
 * "watches a working agent graph... run" half of the demo (E1 spec item 3).
 * Deliberately DB-free and workspace-free, same as `runGraph` itself
 * (features/agents/engine/executor.ts): there's no `agent_runs` row, no
 * `run_steps` row, nothing to clean up after a visitor closes the tab. The
 * client sends back the exact graph `/api/demo/generate` gave it (or its
 * own local fallback graph) since nothing was persisted server-side to
 * fetch by id.
 */
export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid run request." }, { status: 400 });
  }

  const ip = getClientIp(request);
  if (isDemoRateLimited(ip)) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const nodes = parsed.data.nodes as EngineNode[];
  const edges = parsed.data.edges as EngineGraphEdge[];
  const signal = combineSignals(request.signal, AbortSignal.timeout(RUN_TIMEOUT_MS));

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: DemoRunEvent) {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // Reading side already disconnected -- nothing left to notify.
        }
      }

      try {
        const result = await runGraph({
          nodes,
          edges,
          runInput: parsed.data.runInput ?? null,
          signal,
          onStepStart: (event) => send({ type: "step-start", nodeId: event.nodeId, name: event.name, kind: event.kind }),
          onToken: (nodeId, delta) => send({ type: "token", nodeId, delta }),
          onStepEnd: (event) =>
            send({
              type: "step-end",
              nodeId: event.nodeId,
              name: event.name,
              kind: event.kind,
              status: event.status,
              output: event.output,
              errorMessage: event.errorMessage,
            }),
        });
        send({ type: "run-end", status: result.status, finalOutputs: result.finalOutputs, errorMessage: result.errorMessage });
      } catch (error) {
        const message = error instanceof Error ? error.message : "The demo run failed unexpectedly.";
        send({ type: "run-end", status: "failed", finalOutputs: [], errorMessage: message });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by the reading side disconnecting -- fine.
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
