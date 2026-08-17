import { describe, expect, it } from "vitest";
import { resolveCitations } from "./citations";
import type { RetrievedRecord } from "./retrieve";

const retrieved: RetrievedRecord[] = [
  { id: "run-1", type: "run", label: "Lead Qualifier — failed run", href: "/w/acme/agents/a1/runs/run-1", summary: "status: failed" },
  { id: "run-2", type: "run", label: "Lead Qualifier — succeeded run", href: "/w/acme/agents/a1/runs/run-2", summary: "status: succeeded" },
];

describe("resolveCitations", () => {
  it("keeps a citation marker that matches a retrieved record, and resolves its metadata", () => {
    const result = resolveCitations("Lead Qualifier failed twice this week [cite:run-1].", retrieved);
    expect(result.content).toBe("Lead Qualifier failed twice this week [cite:run-1].");
    expect(result.citations).toEqual([
      { id: "run-1", type: "run", label: "Lead Qualifier — failed run", href: "/w/acme/agents/a1/runs/run-1" },
    ]);
  });

  it("drops a citation marker whose id the model invented -- never in the retrieved set", () => {
    const result = resolveCitations("This claim cites a made-up id [cite:run-does-not-exist].", retrieved);
    expect(result.content).toBe("This claim cites a made-up id .");
    expect(result.citations).toEqual([]);
  });

  it("deduplicates a record cited more than once, keeping first-appearance order", () => {
    const result = resolveCitations("[cite:run-2] and again [cite:run-2], plus [cite:run-1].", retrieved);
    expect(result.citations.map((citation) => citation.id)).toEqual(["run-2", "run-1"]);
  });

  it("returns no citations and unmodified content when nothing was retrieved", () => {
    const result = resolveCitations("Plain answer with no data claims.", []);
    expect(result.content).toBe("Plain answer with no data claims.");
    expect(result.citations).toEqual([]);
  });

  it("leaves content with no citation markers untouched", () => {
    const result = resolveCitations("Hello, how can I help today?", retrieved);
    expect(result.content).toBe("Hello, how can I help today?");
    expect(result.citations).toEqual([]);
  });
});
