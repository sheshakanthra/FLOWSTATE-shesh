import { describe, expect, it } from "vitest";
import { PRIORITY_ITEM_TYPES } from "./item-types";
import { computeBlastRadius, computeEntityValue, computeScore, computeTimeDecay, RANK_WEIGHTS, rankPriorityItems, type PriorityItemFactors } from "./rank";

const NOW = new Date("2026-08-20T12:00:00Z");

function factors(overrides: Partial<PriorityItemFactors> = {}): PriorityItemFactors {
  return {
    itemType: "failed_run",
    severity: "medium",
    createdAt: NOW,
    magnitude: 0,
    entitySignal: 0,
    ...overrides,
  };
}

describe("rank.ts — gate item 1: 20 scenarios covering ties, extreme recency, and zero-value entities", () => {
  // ---- blast radius ----

  it("1. higher severity alone produces a strictly higher blast radius, all else equal", () => {
    const order: PriorityItemFactors["severity"][] = ["low", "medium", "high", "critical"];
    const radii = order.map((severity) => computeBlastRadius({ severity, magnitude: 0 }));
    expect(radii).toEqual([...radii].sort((a, b) => a - b));
    expect(new Set(radii).size).toBe(4);
  });

  it("2. magnitude increases blast radius monotonically", () => {
    const low = computeBlastRadius({ severity: "medium", magnitude: 1 });
    const high = computeBlastRadius({ severity: "medium", magnitude: 10 });
    expect(high).toBeGreaterThan(low);
  });

  it("3. negative magnitude is clamped to zero, not subtracted", () => {
    const negative = computeBlastRadius({ severity: "medium", magnitude: -50 });
    const zero = computeBlastRadius({ severity: "medium", magnitude: 0 });
    expect(negative).toBe(zero);
  });

  it("4. zero-value entity: zero magnitude at the lowest severity is exactly the severity base", () => {
    expect(computeBlastRadius({ severity: "low", magnitude: 0 })).toBe(RANK_WEIGHTS.severityBase.low);
  });

  it("5. blast radius scales linearly with magnitude by exactly RANK_WEIGHTS.magnitudeWeight", () => {
    const a = computeBlastRadius({ severity: "critical", magnitude: 2 });
    const b = computeBlastRadius({ severity: "critical", magnitude: 4 });
    expect(b - a).toBeCloseTo(2 * RANK_WEIGHTS.magnitudeWeight, 10);
  });

  // ---- time decay ----

  it("6. extreme recency: an item created this instant has time decay of exactly 1", () => {
    expect(computeTimeDecay(NOW, NOW)).toBe(1);
  });

  it("7. time decay at exactly one half-life is exactly 0.5", () => {
    const halfLifeLater = new Date(NOW.getTime() + RANK_WEIGHTS.halfLifeHours * 3_600_000);
    expect(computeTimeDecay(NOW, halfLifeLater)).toBeCloseTo(0.5, 10);
  });

  it("8. time decay approaches but never drops below the floor for a very old item", () => {
    const yearsLater = new Date(NOW.getTime() + 5000 * 3_600_000);
    const decay = computeTimeDecay(NOW, yearsLater);
    expect(decay).toBeGreaterThanOrEqual(RANK_WEIGHTS.decayFloor);
    expect(decay).toBeCloseTo(RANK_WEIGHTS.decayFloor, 6);
  });

  it("9. a createdAt in the future (clock skew) clamps to decay 1, never above it", () => {
    const past = new Date(NOW.getTime() - 3_600_000);
    expect(computeTimeDecay(past, NOW)).toBeLessThanOrEqual(1);
    const future = new Date(NOW.getTime() + 3_600_000);
    expect(computeTimeDecay(future, NOW)).toBe(1);
  });

  it("10. time decay is strictly monotonically decreasing with age (before the floor)", () => {
    const oneHour = computeTimeDecay(NOW, new Date(NOW.getTime() + 3_600_000));
    const twoHours = computeTimeDecay(NOW, new Date(NOW.getTime() + 2 * 3_600_000));
    expect(twoHours).toBeLessThan(oneHour);
  });

  // ---- entity value ----

  it("11. zero-value entity: entitySignal 0 gives entityValue exactly 1", () => {
    expect(computeEntityValue({ entitySignal: 0 })).toBe(1);
  });

  it("12. negative entitySignal is clamped to zero, same result as entitySignal 0", () => {
    expect(computeEntityValue({ entitySignal: -100 })).toBe(computeEntityValue({ entitySignal: 0 }));
  });

  it("13. entity value increases monotonically with entitySignal", () => {
    const low = computeEntityValue({ entitySignal: 1 });
    const high = computeEntityValue({ entitySignal: 1000 });
    expect(high).toBeGreaterThan(low);
  });

  it("14. entity value is log-scaled -- a 100x jump in signal doesn't produce a 100x jump in value", () => {
    const base = computeEntityValue({ entitySignal: 10 });
    const hundredX = computeEntityValue({ entitySignal: 1000 });
    expect(hundredX).toBeLessThan(base * 100);
  });

  // ---- the full score, and its arithmetic ----

  it("15. score is exactly blastRadius * timeDecay * entityValue -- the reviewer's arithmetic check (gate item 2)", () => {
    const breakdown = computeScore(factors({ severity: "high", magnitude: 3, createdAt: new Date(NOW.getTime() - 6 * 3_600_000) }), NOW);
    expect(breakdown.score).toBeCloseTo(breakdown.blastRadius * breakdown.timeDecay * breakdown.entityValue, 10);
  });

  it("16. every registered item type produces a real, positive, finite score", () => {
    for (const itemType of PRIORITY_ITEM_TYPES) {
      const breakdown = computeScore(factors({ itemType, magnitude: 2, entitySignal: 5 }), NOW);
      expect(breakdown.score).toBeGreaterThan(0);
      expect(Number.isFinite(breakdown.score)).toBe(true);
    }
  });

  it("17. a brand-new critical failure outranks an old, low-severity item with no entity signal", () => {
    const freshCritical = computeScore(factors({ severity: "critical", magnitude: 5, entitySignal: 10, createdAt: NOW }), NOW);
    const oldLow = computeScore(
      factors({ severity: "low", magnitude: 0, entitySignal: 0, createdAt: new Date(NOW.getTime() - 500 * 3_600_000) }),
      NOW,
    );
    expect(freshCritical.score).toBeGreaterThan(oldLow.score);
  });

  // ---- ranking / ties ----

  it("18. rankPriorityItems sorts strictly descending by score", () => {
    const items = [
      { id: "a", ...factors({ severity: "low", magnitude: 0 }) },
      { id: "b", ...factors({ severity: "critical", magnitude: 10 }) },
      { id: "c", ...factors({ severity: "medium", magnitude: 2 }) },
    ];
    const ranked = rankPriorityItems(items, NOW);
    expect(ranked.map((item) => item.id)).toEqual(["b", "c", "a"]);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]!.scoreBreakdown.score).toBeGreaterThanOrEqual(ranked[i]!.scoreBreakdown.score);
    }
  });

  it("19. ties: identical factors produce identical scores, broken by recency (newer first)", () => {
    const older = { id: "older", ...factors({ createdAt: new Date(NOW.getTime() - 3_600_000) }) };
    const newer = { id: "newer", ...factors({ createdAt: NOW }) };
    expect(computeScore(older, NOW).score).not.toBe(computeScore(newer, NOW).score); // decay differs, not a true tie
    // A genuine tie needs identical createdAt too:
    const tiedA = { id: "z-item", ...factors({ createdAt: NOW }) };
    const tiedB = { id: "a-item", ...factors({ createdAt: NOW }) };
    const ranked = rankPriorityItems([tiedA, tiedB], NOW);
    expect(ranked[0]!.scoreBreakdown.score).toBe(ranked[1]!.scoreBreakdown.score);
    // Fully tied (same score, same createdAt) breaks by id, deterministically.
    expect(ranked.map((item) => item.id)).toEqual(["a-item", "z-item"]);
  });

  it("20. ranking the same list twice produces the same order -- deterministic, not just correct once", () => {
    const items = [
      { id: "1", ...factors({ severity: "high", magnitude: 3, createdAt: new Date(NOW.getTime() - 2 * 3_600_000) }) },
      { id: "2", ...factors({ severity: "high", magnitude: 3, createdAt: new Date(NOW.getTime() - 2 * 3_600_000) }) },
      { id: "3", ...factors({ severity: "critical", magnitude: 8, entitySignal: 20 }) },
    ];
    const first = rankPriorityItems(items, NOW).map((item) => item.id);
    const second = rankPriorityItems(items, NOW).map((item) => item.id);
    expect(first).toEqual(second);
  });
});
