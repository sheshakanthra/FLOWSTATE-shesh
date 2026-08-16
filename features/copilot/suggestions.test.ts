import { describe, expect, it } from "vitest";
import { EMPTY_ENVELOPE, type CopilotContext } from "./context/envelope";
import { sectionForRoute, suggestedPrompts } from "./suggestions";

function envelopeAt(route: string): CopilotContext {
  return { ...EMPTY_ENVELOPE, route };
}

describe("sectionForRoute", () => {
  it.each([
    ["/w/meridian-ops/today", "today"],
    ["/w/meridian-ops/agents", "agents-index"],
    ["/w/meridian-ops/agents/agent-1/build", "agent-build"],
    ["/w/meridian-ops/agents/agent-1/runs", "agent-runs"],
    ["/w/meridian-ops/agents/agent-1/runs/run-1", "agent-trace"],
    ["/w/meridian-ops/agents/agent-1/versions", "agent-versions"],
    ["/w/meridian-ops/flows", "flows"],
    ["/w/meridian-ops/insights", "insights"],
    ["/w/meridian-ops/knowledge", "knowledge"],
    ["/w/meridian-ops/settings", "settings"],
  ])("maps %s to %s", (route, expected) => {
    expect(sectionForRoute(route)).toBe(expected);
  });

  it("falls back to the workspace section for anything unrecognized", () => {
    expect(sectionForRoute("/w/meridian-ops")).toBe("workspace");
    expect(sectionForRoute("/login")).toBe("workspace");
    expect(sectionForRoute("")).toBe("workspace");
    expect(sectionForRoute("/w/meridian-ops/something-new")).toBe("workspace");
  });
});

describe("suggestedPrompts", () => {
  it("always returns exactly three", () => {
    for (const route of [
      "/w/meridian-ops/today",
      "/w/meridian-ops/agents",
      "/w/meridian-ops/agents/agent-1/build",
      "/w/meridian-ops/agents/agent-1/runs/run-1",
      "/login",
    ]) {
      expect(suggestedPrompts(envelopeAt(route), null)).toHaveLength(3);
    }
  });

  /** Gate item 8, checked here as well as in a real browser. */
  it("differs between /today and an agent build page", () => {
    const today = suggestedPrompts(envelopeAt("/w/meridian-ops/today"), "Meridian Ops");
    const build = suggestedPrompts(envelopeAt("/w/meridian-ops/agents/agent-1/build"), "Recall Scheduler");
    expect(today).not.toEqual(build);
    expect(today.some((prompt) => prompt.includes("Recall Scheduler"))).toBe(false);
  });

  it("names the entity in context rather than saying 'this agent'", () => {
    const prompts = suggestedPrompts(envelopeAt("/w/meridian-ops/agents/agent-1/build"), "Recall Scheduler");
    expect(prompts.some((prompt) => prompt.includes("Recall Scheduler"))).toBe(true);
    expect(prompts.some((prompt) => prompt.includes("this agent"))).toBe(false);
  });

  it("falls back to a section-appropriate subject when nothing is in context", () => {
    const build = suggestedPrompts(envelopeAt("/w/meridian-ops/agents/agent-1/build"), null);
    expect(build.some((prompt) => prompt.includes("this agent"))).toBe(true);

    const workspace = suggestedPrompts(envelopeAt("/w/meridian-ops"), null);
    expect(workspace.some((prompt) => prompt.includes("this workspace"))).toBe(true);
  });
});
