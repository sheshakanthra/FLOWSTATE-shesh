import type { ActivityEventRecord, InFlightRunRecord } from "@/lib/repos/metrics";
import type { PriorityItemRecord } from "@/lib/repos/priorities";
import type { PriorityItemClient } from "@/features/today/priority/store";
import type { LiveActivityEvent, LiveRunRecord } from "./events";

/**
 * The one place a `lib/repos/*` record (real `Date` fields) turns into the
 * client-safe wire shape (ISO strings -- see events.ts's own doc comment
 * for why that distinction is load-bearing). Both `app/api/live/route.ts`
 * (every live patch) and `app/(app)/w/[workspace]/today/page.tsx` (the
 * initial server-rendered snapshot each query is seeded with) call these,
 * so the two can never drift into serializing the same record two
 * different ways.
 */
export function toLiveRun(run: InFlightRunRecord): LiveRunRecord {
  return {
    id: run.id,
    agentId: run.agentId,
    agentName: run.agentName,
    status: run.status,
    trigger: run.trigger,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
    currentNodeName: run.currentNodeName,
    currentStepIndex: run.currentStepIndex,
    liveCostCents: run.liveCostCents,
    errorMessage: run.errorMessage,
  };
}

export function toLivePriorityItem(item: PriorityItemRecord): PriorityItemClient {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    severity: item.severity,
    itemType: item.itemType,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    assigneeId: item.assigneeId,
    assigneeName: item.assigneeName,
    resolved: item.resolved,
    magnitude: item.magnitude,
    entitySignal: item.entitySignal,
    snoozedUntil: item.snoozedUntil ? item.snoozedUntil.toISOString() : null,
    createdAt: item.createdAt.toISOString(),
  };
}

export function toLiveActivityEvent(event: ActivityEventRecord): LiveActivityEvent {
  return {
    id: event.id,
    actorId: event.actorId,
    actorName: event.actorName,
    verb: event.verb,
    subjectType: event.subjectType,
    subjectId: event.subjectId,
    summary: event.summary,
    createdAt: event.createdAt.toISOString(),
  };
}
