import type { RunStatus, MetricsRollup } from "@/lib/repos/metrics";
import type { PriorityItemClient } from "@/features/today/priority/store";

/**
 * Wire shapes -- every date is a string, never a `Date`. `JSON.stringify`
 * over SSE already serializes a `Date` field to an ISO string on the way
 * out; without a distinct client-side type saying so, the TypeScript shape
 * would keep claiming it's still a `Date` after `JSON.parse` on the way
 * back in, which is exactly the kind of lie that produces a real runtime
 * bug (`.getTime()` on a string) rather than a caught compile error.
 * `LivePriorityItem` reuses D1's own `PriorityItemClient`
 * (features/today/priority/store.ts) instead of redeclaring an equivalent
 * shape -- that type exists for precisely this "dates are strings on the
 * client" reason already.
 */
export interface LiveRunRecord {
  id: string;
  agentId: string;
  agentName: string;
  status: RunStatus;
  trigger: string;
  startedAt: string;
  finishedAt: string | null;
  currentNodeName: string | null;
  currentStepIndex: number | null;
  liveCostCents: number;
  errorMessage: string | null;
}

export interface LiveActivityEvent {
  id: string;
  actorId: string | null;
  actorName: string | null;
  verb: string;
  subjectType: string;
  subjectId: string | null;
  summary: string;
  createdAt: string;
}

/**
 * The wire shape `/api/live` (app/api/live/route.ts) sends and
 * `sse-client.ts`/`cache-patch.ts` consume -- the one shared source of
 * truth for both sides, so a field added to one is a type error on the
 * other instead of a silent runtime mismatch. Lives here, not in the route
 * file, so client code can `import type` it without depending on a Route
 * Handler module -- every import above is `import type`-only, so none of
 * `lib/repos/*`'s real, server-only implementations (db/client.ts's
 * Postgres connection included) ever reach the client bundle, only the
 * erased type shape does.
 */
export type LiveEvent =
  | { type: "run_upsert"; run: LiveRunRecord }
  | { type: "run_remove"; runId: string }
  | { type: "priority_upsert"; item: PriorityItemClient }
  | { type: "priority_remove"; itemId: string }
  | { type: "activity_upsert"; event: LiveActivityEvent }
  | { type: "metrics_update"; metrics: MetricsRollup };

export type LiveEventType = LiveEvent["type"];
