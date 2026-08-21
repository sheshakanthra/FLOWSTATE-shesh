import { describe, expect, it } from "vitest";
import { groupActivityByEntity } from "./group";
import type { LiveActivityEvent } from "../live/events";

function makeEvent(overrides: Partial<LiveActivityEvent>): LiveActivityEvent {
  return {
    id: crypto.randomUUID(),
    actorId: null,
    actorName: null,
    verb: "agent.updated",
    subjectType: "agent",
    subjectId: "agent-1",
    summary: "did something",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("groupActivityByEntity", () => {
  it("gate item 8: 40 events across 8 real entities collapse into 8 groups, not 40 rows", () => {
    const agentIds = Array.from({ length: 8 }, (_, i) => `agent-${i}`);
    const events: LiveActivityEvent[] = Array.from({ length: 40 }, (_, i) =>
      makeEvent({ subjectId: agentIds[i % agentIds.length], id: `event-${i}` }),
    );
    const groups = groupActivityByEntity(events);
    expect(groups).toHaveLength(8);
    expect(groups.reduce((sum, group) => sum + group.events.length, 0)).toBe(40);
  });

  it("preserves every event -- no group silently drops one", () => {
    const events = Array.from({ length: 15 }, (_, i) => makeEvent({ subjectId: `agent-${i % 3}`, id: `event-${i}` }));
    const groups = groupActivityByEntity(events);
    const total = groups.reduce((sum, group) => sum + group.events.length, 0);
    expect(total).toBe(15);
  });

  it("events with no subjectId group by subjectType alone", () => {
    const events = [
      makeEvent({ subjectType: "member", subjectId: null, summary: "Jordan joined" }),
      makeEvent({ subjectType: "member", subjectId: null, summary: "Sam joined" }),
    ];
    const groups = groupActivityByEntity(events);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.events).toHaveLength(2);
  });

  it("different subjectTypes never merge, even both with no subjectId", () => {
    const events = [
      makeEvent({ subjectType: "member", subjectId: null }),
      makeEvent({ subjectType: "workspace", subjectId: null }),
    ];
    const groups = groupActivityByEntity(events);
    expect(groups).toHaveLength(2);
  });

  it("a single entity's events all land in one group, in their original (newest-first) order", () => {
    const events = [
      makeEvent({ subjectId: "agent-1", summary: "third" }),
      makeEvent({ subjectId: "agent-1", summary: "second" }),
      makeEvent({ subjectId: "agent-1", summary: "first" }),
    ];
    const groups = groupActivityByEntity(events);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.events.map((e) => e.summary)).toEqual(["third", "second", "first"]);
  });

  it("an empty event list produces zero groups, not a crash", () => {
    expect(groupActivityByEntity([])).toEqual([]);
  });
});
