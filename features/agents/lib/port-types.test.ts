import { describe, expect, it } from "vitest";
import { arePortTypesCompatible, describeIncompatibility, PORT_TYPES } from "./port-types";

describe("arePortTypesCompatible", () => {
  it("matches identical types", () => {
    for (const type of PORT_TYPES) {
      expect(arePortTypesCompatible(type, type)).toBe(true);
    }
  });

  it("any accepts everything and everything accepts any", () => {
    for (const type of PORT_TYPES) {
      expect(arePortTypesCompatible("any", type)).toBe(true);
      expect(arePortTypesCompatible(type, "any")).toBe(true);
    }
  });

  it("rejects mismatched concrete types -- text cannot connect to document", () => {
    expect(arePortTypesCompatible("text", "document")).toBe(false);
    expect(arePortTypesCompatible("document", "text")).toBe(false);
  });

  it("rejects every other mismatched pair", () => {
    const concrete = PORT_TYPES.filter((type) => type !== "any");
    for (const source of concrete) {
      for (const target of concrete) {
        if (source === target) continue;
        expect(arePortTypesCompatible(source, target)).toBe(false);
      }
    }
  });
});

describe("describeIncompatibility", () => {
  it("names both types in the reason", () => {
    const reason = describeIncompatibility("text", "document");
    expect(reason).toContain("text");
    expect(reason).toContain("document");
  });
});
