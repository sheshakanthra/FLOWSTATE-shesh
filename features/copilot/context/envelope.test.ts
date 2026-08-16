import { describe, expect, it } from "vitest";
import {
  RECENT_ACTIONS_LIMIT,
  buildEnvelope,
  copilotContextSchema,
  deriveChips,
  restorableChips,
  type ContextContribution,
  type RecentAction,
} from "./envelope";

const workspaceBaseline: ContextContribution = {
  id: "workspace",
  entity: { type: "workspace", id: "ws-1", label: "Meridian Ops" },
};

const agentContribution: ContextContribution = {
  id: "agent-builder",
  entity: { type: "agent", id: "agent-1", label: "Recall Scheduler" },
  selection: { type: "node", ids: ["node-a", "node-b"] },
};

const runsContribution: ContextContribution = {
  id: "agent-runs",
  entity: { type: "agent", id: "agent-1", label: "Recall Scheduler" },
  selection: { type: "run", ids: ["run-1", "run-2", "run-3"] },
  filters: { status: ["failed"] },
  dateRange: { from: "2026-08-06T00:00:00.000Z", to: "2026-08-13T00:00:00.000Z", label: "Last 7 days" },
};

const recentActions: RecentAction[] = [
  { action: "Edited prompt", entity: "Recall Scheduler", at: "2026-08-13T09:00:00.000Z" },
  { action: "Added node", entity: "Recall Scheduler", at: "2026-08-13T08:59:00.000Z" },
];

describe("buildEnvelope", () => {
  it("produces a valid envelope from nothing at all", () => {
    const envelope = buildEnvelope({ route: "/w/meridian-ops/today", contributions: [], recentActions: [] });
    expect(copilotContextSchema.safeParse(envelope).success).toBe(true);
    expect(envelope).toEqual({
      route: "/w/meridian-ops/today",
      entity: { type: null, id: null },
      selection: null,
      filters: {},
      dateRange: null,
      recentActions: [],
    });
  });

  it("lets a page-level contribution win the entity over the workspace baseline", () => {
    const envelope = buildEnvelope({
      route: "/w/meridian-ops/agents/agent-1/build",
      contributions: [workspaceBaseline, agentContribution],
      recentActions: [],
    });
    expect(envelope.entity).toEqual({ type: "agent", id: "agent-1" });
    // The label never reaches the envelope -- ids travel, names are for chips.
    expect(JSON.stringify(envelope)).not.toContain("Recall Scheduler");
  });

  it("merges filters across contributions and carries a resolved date range", () => {
    const envelope = buildEnvelope({
      route: "/w/meridian-ops/agents/agent-1/runs",
      contributions: [
        workspaceBaseline,
        runsContribution,
        { id: "other", filters: { trigger: "manual" } },
      ],
      recentActions: [],
    });
    expect(envelope.filters).toEqual({ status: ["failed"], trigger: "manual" });
    expect(envelope.dateRange).toEqual({
      from: "2026-08-06T00:00:00.000Z",
      to: "2026-08-13T00:00:00.000Z",
    });
    // The chip's human label is deliberately not part of the sent range.
    expect(envelope.dateRange).not.toHaveProperty("label");
  });

  it("treats an empty selection as no selection", () => {
    const envelope = buildEnvelope({
      route: "/w/meridian-ops/agents",
      contributions: [{ id: "agents-index", selection: { type: "agent", ids: [] } }],
      recentActions: [],
    });
    expect(envelope.selection).toBeNull();
  });

  it("empties an excluded field without changing the envelope's shape", () => {
    const envelope = buildEnvelope({
      route: "/w/meridian-ops/agents/agent-1/runs",
      contributions: [workspaceBaseline, runsContribution],
      recentActions,
      excluded: ["entity", "selection", "filters", "dateRange", "recentActions"],
    });
    expect(copilotContextSchema.safeParse(envelope).success).toBe(true);
    expect(envelope.entity).toEqual({ type: null, id: null });
    expect(envelope.selection).toBeNull();
    expect(envelope.filters).toEqual({});
    expect(envelope.dateRange).toBeNull();
    expect(envelope.recentActions).toEqual([]);
    // Route survives every exclusion -- it isn't a chip.
    expect(envelope.route).toBe("/w/meridian-ops/agents/agent-1/runs");
  });

  it("excluding one field leaves the others intact", () => {
    const envelope = buildEnvelope({
      route: "/w/meridian-ops/agents/agent-1/runs",
      contributions: [workspaceBaseline, runsContribution],
      recentActions,
      excluded: ["selection"],
    });
    expect(envelope.selection).toBeNull();
    expect(envelope.entity).toEqual({ type: "agent", id: "agent-1" });
    expect(envelope.filters).toEqual({ status: ["failed"] });
    expect(envelope.recentActions).toHaveLength(2);
  });

  it("caps recentActions at the spec's limit", () => {
    const many: RecentAction[] = Array.from({ length: 25 }, (_, index) => ({
      action: `Action ${index}`,
      entity: "Recall Scheduler",
      at: new Date(2026, 7, 13, 9, index).toISOString(),
    }));
    const envelope = buildEnvelope({ route: "/w/meridian-ops/today", contributions: [], recentActions: many });
    expect(envelope.recentActions).toHaveLength(RECENT_ACTIONS_LIMIT);
    expect(envelope.recentActions[0]!.action).toBe("Action 0");
  });
});

describe("deriveChips", () => {
  it("labels each field the way the spec's own examples read", () => {
    const chips = deriveChips({
      contributions: [workspaceBaseline, runsContribution],
      recentActions,
    });
    const labels = chips.map((chip) => chip.label);
    expect(labels).toContain("Agent: Recall Scheduler");
    expect(labels).toContain("3 runs selected");
    expect(labels).toContain("Filters: status");
    expect(labels).toContain("Last 7 days");
    expect(labels).toContain("2 recent actions");
  });

  it("uses the singular for a one-item selection", () => {
    const chips = deriveChips({
      contributions: [{ id: "runs", selection: { type: "run", ids: ["run-1"] } }],
      recentActions: [],
    });
    expect(chips.map((chip) => chip.label)).toContain("1 run selected");
  });

  it("drops an excluded chip and offers it back as restorable", () => {
    const input = { contributions: [workspaceBaseline, runsContribution], recentActions, excluded: ["entity" as const] };
    expect(deriveChips(input).map((chip) => chip.field)).not.toContain("entity");
    expect(restorableChips(input).map((chip) => chip.field)).toEqual(["entity"]);
  });

  it("offers nothing to restore for a field that had no content to begin with", () => {
    expect(
      restorableChips({ contributions: [], recentActions: [], excluded: ["selection", "filters"] }),
    ).toEqual([]);
  });

  it("produces no chips at all when nothing has been contributed", () => {
    expect(deriveChips({ contributions: [], recentActions: [] })).toEqual([]);
  });
});
