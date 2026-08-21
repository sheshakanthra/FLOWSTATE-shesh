import { requireRole } from "@/lib/auth/guard";
import { getMetricsRollup, listInFlightRuns, listRecentActivity } from "@/lib/repos/metrics";
import { listPriorityItems } from "@/lib/repos/priorities";
import type { LiveEvent } from "@/features/today/live/events";
import { toLiveActivityEvent, toLivePriorityItem, toLiveRun } from "@/features/today/live/serialize";

/**
 * Session spec item 3: `/api/live` streams run events, and the client
 * patches its TanStack Query cache directly from them rather than
 * invalidating (features/today/live/cache-patch.ts) -- what makes that
 * meaningful rather than a full-refetch-in-disguise is that every event
 * this route sends is already a *targeted* upsert or remove for one row,
 * not "something changed, go refetch."
 *
 * One SSE connection per browser tab, each with its own independent poll
 * loop and its own in-memory "what did I last tell this client" snapshot
 * (the closures below) -- deliberately not a single shared server-side
 * poll fanned out to every connection. Two reasons: C2 already found that
 * Next.js Route Handlers don't reliably share module-level state across
 * requests in this dev environment (see features/copilot/lib/cancellation.ts's
 * doc comment), and per-connection polling makes reconnect/catch-up
 * (gate item 3) trivial by construction -- a fresh connection starts with
 * an empty snapshot, so its first tick naturally emits every currently-active
 * row as an upsert, which the client applies idempotently by id. No
 * separate "resume from where you left off" protocol was needed.
 */
const POLL_INTERVAL_MS = 800;
const HEARTBEAT_INTERVAL_MS = 15_000;

/** Diffs `current` (keyed by `getId`) against `previous`'s last-sent
 *  serialization, returning what changed and the snapshot to remember for
 *  next tick. A row whose serialized form is unchanged emits nothing --
 *  this is the actual mechanism behind "patch, don't invalidate": the vast
 *  majority of ticks touch nothing, so they produce zero events. */
function diffById<T>(
  previous: Map<string, string>,
  current: T[],
  getId: (item: T) => string,
): { upserts: T[]; removedIds: string[]; next: Map<string, string> } {
  const next = new Map<string, string>();
  const upserts: T[] = [];
  for (const item of current) {
    const id = getId(item);
    const serialized = JSON.stringify(item);
    next.set(id, serialized);
    if (previous.get(id) !== serialized) upserts.push(item);
  }
  const removedIds = [...previous.keys()].filter((id) => !next.has(id));
  return { upserts, removedIds, next };
}

export async function GET(request: Request) {
  const workspaceSlug = new URL(request.url).searchParams.get("workspaceSlug");
  if (!workspaceSlug) {
    return Response.json({ error: "workspaceSlug query parameter is required." }, { status: 400 });
  }

  const context = await requireRole(request, workspaceSlug, "member");
  if (context instanceof Response) return context;
  const workspaceId = context.workspace.id;

  const encoder = new TextEncoder();
  let runSnapshot = new Map<string, string>();
  let prioritySnapshot = new Map<string, string>();
  const seenActivityIds = new Set<string>();
  let lastMetricsSerialized: string | null = null;
  let lastSentAt = Date.now();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      function send(event: LiveEvent) {
        lastSentAt = Date.now();
        try {
          controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
        } catch {
          // The reading side disconnected before this tick's writes
          // finished -- the poll loop below notices via `closed` on its
          // next iteration and stops scheduling further work.
          closed = true;
        }
      }

      function heartbeat() {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          closed = true;
        }
      }

      async function tick() {
        if (closed || request.signal.aborted) {
          closed = true;
          return;
        }

        const [runs, priorities, activity, metrics] = await Promise.all([
          listInFlightRuns(workspaceId),
          listPriorityItems(workspaceId),
          listRecentActivity(workspaceId),
          getMetricsRollup(workspaceId),
        ]);

        const runDiff = diffById(runSnapshot, runs.map(toLiveRun), (run) => run.id);
        runSnapshot = runDiff.next;
        for (const run of runDiff.upserts) send({ type: "run_upsert", run });
        for (const runId of runDiff.removedIds) send({ type: "run_remove", runId });

        const priorityDiff = diffById(prioritySnapshot, priorities.map(toLivePriorityItem), (item) => item.id);
        prioritySnapshot = priorityDiff.next;
        for (const item of priorityDiff.upserts) send({ type: "priority_upsert", item });
        for (const itemId of priorityDiff.removedIds) send({ type: "priority_remove", itemId });

        // Activity events are immutable once created -- "new" is the only
        // state transition, so presence alone (not a content diff) is
        // what decides whether to send one.
        for (const event of activity) {
          if (seenActivityIds.has(event.id)) continue;
          seenActivityIds.add(event.id);
          send({ type: "activity_upsert", event: toLiveActivityEvent(event) });
        }

        const metricsSerialized = JSON.stringify(metrics);
        if (metricsSerialized !== lastMetricsSerialized) {
          lastMetricsSerialized = metricsSerialized;
          send({ type: "metrics_update", metrics });
        }

        if (Date.now() - lastSentAt >= HEARTBEAT_INTERVAL_MS) heartbeat();
      }

      (async () => {
        while (!closed && !request.signal.aborted) {
          await tick().catch(() => {
            // A transient DB hiccup on one tick shouldn't tear down the
            // whole connection -- the next tick tries again.
          });
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      })();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
