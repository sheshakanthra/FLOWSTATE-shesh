import { describe, expect, it } from "vitest";
import { computeMetricsRollup } from "./metrics";

const NOW = new Date("2026-08-20T15:00:00Z");
const TODAY_START = Date.UTC(2026, 7, 20);
const YESTERDAY_START = TODAY_START - 24 * 60 * 60 * 1000;

describe("computeMetricsRollup", () => {
  it("counts only today's runs toward runsToday", () => {
    const rollup = computeMetricsRollup(
      [
        { status: "succeeded", startedAt: new Date(TODAY_START + 3600_000), costUsd: 0.01 },
        { status: "succeeded", startedAt: new Date(TODAY_START + 7200_000), costUsd: 0.01 },
        { status: "succeeded", startedAt: new Date(YESTERDAY_START + 3600_000), costUsd: 0.01 },
      ],
      [],
      NOW,
    );
    expect(rollup.runsToday).toBe(2);
  });

  it("success rate is succeeded / (succeeded + failed) across the whole 7-day window, excluding running/cancelled", () => {
    const rollup = computeMetricsRollup(
      [
        { status: "succeeded", startedAt: NOW, costUsd: 0 },
        { status: "succeeded", startedAt: NOW, costUsd: 0 },
        { status: "succeeded", startedAt: NOW, costUsd: 0 },
        { status: "failed", startedAt: NOW, costUsd: 0 },
        { status: "running", startedAt: NOW, costUsd: null },
        { status: "cancelled", startedAt: NOW, costUsd: 0 },
      ],
      [],
      NOW,
    );
    expect(rollup.successRate).toBeCloseTo(0.75, 10);
  });

  it("success rate is null (not 0) when nothing has finished yet", () => {
    const rollup = computeMetricsRollup([{ status: "running", startedAt: NOW, costUsd: null }], [], NOW);
    expect(rollup.successRate).toBeNull();
  });

  it("spendThisWeekUsd sums real cost across the window, treating null cost as 0", () => {
    const rollup = computeMetricsRollup(
      [
        { status: "succeeded", startedAt: NOW, costUsd: 1.5 },
        { status: "failed", startedAt: NOW, costUsd: 0.25 },
        { status: "running", startedAt: NOW, costUsd: null },
      ],
      [],
      NOW,
    );
    expect(rollup.spendThisWeekUsd).toBeCloseTo(1.75, 10);
  });

  it("activeAgents counts enabled, non-archived agents only", () => {
    const rollup = computeMetricsRollup(
      [],
      [
        { enabled: true, status: "published", createdAt: NOW },
        { enabled: true, status: "draft", createdAt: NOW },
        { enabled: false, status: "published", createdAt: NOW },
        { enabled: true, status: "archived", createdAt: NOW },
      ],
      NOW,
    );
    expect(rollup.activeAgents).toBe(2);
  });

  it("a run outside the 7-day window is excluded from every sparkline bucket", () => {
    const eightDaysAgo = new Date(TODAY_START - 8 * 24 * 60 * 60 * 1000);
    const rollup = computeMetricsRollup([{ status: "succeeded", startedAt: eightDaysAgo, costUsd: 5 }], [], NOW);
    expect(rollup.sparklines.runsPerDay.reduce((a, b) => a + b, 0)).toBe(0);
    expect(rollup.spendThisWeekUsd).toBe(0);
  });

  it("sparklines have exactly 7 buckets, oldest first, today last", () => {
    const rollup = computeMetricsRollup(
      [{ status: "succeeded", startedAt: NOW, costUsd: 1 }],
      [{ enabled: true, status: "published", createdAt: NOW }],
      NOW,
    );
    expect(rollup.sparklines.runsPerDay).toHaveLength(7);
    expect(rollup.sparklines.runsPerDay[6]).toBe(1);
    expect(rollup.sparklines.runsPerDay.slice(0, 6).every((count) => count === 0)).toBe(true);
  });

  it("activeAgentsPerDay reflects an agent only from the day it was created onward", () => {
    const createdThreeDaysAgo = new Date(TODAY_START - 3 * 24 * 60 * 60 * 1000 + 3600_000);
    const rollup = computeMetricsRollup([], [{ enabled: true, status: "published", createdAt: createdThreeDaysAgo }], NOW);
    // Bucket index: day 3 (0-indexed from the 7-day window start) is when it first appears.
    expect(rollup.sparklines.activeAgentsPerDay[3]).toBe(1);
    expect(rollup.sparklines.activeAgentsPerDay[2]).toBe(0);
    expect(rollup.sparklines.activeAgentsPerDay[6]).toBe(1);
  });

  it("with zero runs and zero agents, every number is a real zero (or null for success rate), never NaN", () => {
    const rollup = computeMetricsRollup([], [], NOW);
    expect(rollup.runsToday).toBe(0);
    expect(rollup.successRate).toBeNull();
    expect(rollup.spendThisWeekUsd).toBe(0);
    expect(rollup.activeAgents).toBe(0);
    for (const series of Object.values(rollup.sparklines)) {
      expect(series.every((value: number) => Number.isFinite(value))).toBe(true);
    }
  });
});
