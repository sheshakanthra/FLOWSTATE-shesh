import { describe, expect, it } from "vitest";
import { evaluateCondition } from "./condition";

describe("evaluateCondition", () => {
  it("evaluates numeric comparisons", () => {
    expect(evaluateCondition("5 > 3")).toBe(true);
    expect(evaluateCondition("5 < 3")).toBe(false);
    expect(evaluateCondition("5 >= 5")).toBe(true);
    expect(evaluateCondition("4 <= 3")).toBe(false);
  });

  it("evaluates equality against strings and booleans", () => {
    expect(evaluateCondition('"ok" == "ok"')).toBe(true);
    expect(evaluateCondition("true == true")).toBe(true);
    expect(evaluateCondition("true != false")).toBe(true);
  });

  it("evaluates logical and/or/not with correct precedence", () => {
    expect(evaluateCondition("true && false")).toBe(false);
    expect(evaluateCondition("true || false")).toBe(true);
    expect(evaluateCondition("!false")).toBe(true);
    expect(evaluateCondition("false || (true && true)")).toBe(true);
  });

  it("treats a bare truthy/falsy literal as the whole result", () => {
    expect(evaluateCondition("true")).toBe(true);
    expect(evaluateCondition("0")).toBe(false);
    expect(evaluateCondition('""')).toBe(false);
  });

  it("returns null for an empty expression, letting the caller fall back", () => {
    expect(evaluateCondition("")).toBeNull();
    expect(evaluateCondition("   ")).toBeNull();
  });

  it("never throws on malformed input", () => {
    expect(() => evaluateCondition("&& ||| ((( unbalanced")).not.toThrow();
  });
});
