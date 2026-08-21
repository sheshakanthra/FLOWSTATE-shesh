import type { LiveActivityEvent } from "../live/events";

export interface ActivityGroup {
  key: string;
  subjectType: string;
  subjectId: string | null;
  /** Newest first -- the same order `lib/repos/metrics.ts#listRecentActivity`
   *  already returns events in, preserved rather than re-sorted per group. */
  events: LiveActivityEvent[];
}

function groupKey(event: LiveActivityEvent): string {
  // No `subjectId` (a workspace-level "system" event, or a `member.joined`
  // row that predates any per-member subject tracking) groups by
  // `subjectType` alone -- there's no finer real entity key available for
  // these, and collapsing e.g. every `member.joined` event together is a
  // legitimate reading of "grouped by entity," not a loss of information a
  // user would actually want split out into separate rows.
  return event.subjectId ? `${event.subjectType}:${event.subjectId}` : `${event.subjectType}:none`;
}

/**
 * Session spec item 7 / gate item 8: "grouped by entity rather than by
 * time... 40 events into a readable number of groups, not 40 rows."
 * `events` is expected newest-first (its one real caller,
 * `lib/repos/metrics.ts#listRecentActivity`, already orders that way) --
 * groups inherit their recency from whichever of their own events was
 * pushed first, so the returned groups themselves come back newest-first
 * too, without a second sort pass needing to look inside each group.
 */
export function groupActivityByEntity(events: LiveActivityEvent[]): ActivityGroup[] {
  const groups = new Map<string, ActivityGroup>();
  for (const event of events) {
    const key = groupKey(event);
    const existing = groups.get(key);
    if (existing) {
      existing.events.push(event);
    } else {
      groups.set(key, { key, subjectType: event.subjectType, subjectId: event.subjectId, events: [event] });
    }
  }
  return Array.from(groups.values());
}
