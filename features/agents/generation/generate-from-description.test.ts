import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateGraph } from "../lib/validate-graph";

/** Every case here mocks `getProvider().complete` directly (the same
 *  `vi.doMock` + dynamic `import()` shape `executor.test.ts` established for
 *  exactly this "swap the LLM provider for a canned response" need) --
 *  these are unit tests of `assembleGraph`'s deterministic assembly, not a
 *  live-Groq test (that's covered by this session's own manual live
 *  verification, per PROGRESS.md's established precedent for LLM-backed
 *  logic). */
describe("generateAgentFromDescription", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("assembles a real, valid graph from a plan whose steps chain cleanly (matching lead-qualifier's own shape)", async () => {
    const plan = {
      name: "Inbound Lead Qualifier",
      description: "Scores a new inbound lead.",
      steps: [
        { type: "trigger", label: "New inbound lead", config: { triggerType: "webhook" } },
        { type: "transform", label: "Prep lead details", config: {} },
        { type: "llm", label: "Qualify lead", config: { systemPrompt: "Score this lead." } },
        { type: "condition", label: "Worth a call?", config: {} },
        { type: "output", label: "Notify sales", config: { destination: "sales-team-notification" } },
      ],
    };

    vi.doMock("@/lib/llm/provider", () => ({
      getProvider: () => ({ complete: () => Promise.resolve({ content: JSON.stringify(plan), usage: { promptTokens: 0, completionTokens: 0 } }) }),
    }));
    const { generateAgentFromDescription } = await import("./generate-from-description");

    const result = await generateAgentFromDescription("qualify inbound leads");

    expect(result.name).toBe("Inbound Lead Qualifier");
    expect(result.graph.nodes).toHaveLength(5);
    expect(result.graph.edges).toHaveLength(4);
    const issues = validateGraph(
      result.graph.nodes.map((node) => ({ id: node.id, type: node.type, data: node.data })),
      result.graph.edges,
    );
    expect(issues).toEqual([]);

    vi.doUnmock("@/lib/llm/provider");
  });

  it("bridges two adjacent steps whose ports don't type-match with a transform node, same as lead-qualifier's own template", async () => {
    // trigger's only output is a "signal" -- llm's "prompt" input is "text".
    // Neither is "any", so a direct connection isn't legal; the plan below
    // proposes exactly that (no transform in between) to prove the
    // assembler inserts one rather than producing an invalid edge.
    const plan = {
      name: "Direct Chain",
      description: "Goes straight from trigger to llm.",
      steps: [
        { type: "trigger", label: "Start", config: {} },
        { type: "llm", label: "Think", config: { systemPrompt: "Do the thing." } },
      ],
    };

    vi.doMock("@/lib/llm/provider", () => ({
      getProvider: () => ({ complete: () => Promise.resolve({ content: JSON.stringify(plan), usage: { promptTokens: 0, completionTokens: 0 } }) }),
    }));
    const { generateAgentFromDescription } = await import("./generate-from-description");

    const result = await generateAgentFromDescription("do a thing");

    // trigger, bridge, llm, output (appended since llm has an output port).
    expect(result.graph.nodes.map((node) => node.type)).toEqual(["trigger", "transform", "llm", "output"]);
    const issues = validateGraph(
      result.graph.nodes.map((node) => ({ id: node.id, type: node.type, data: node.data })),
      result.graph.edges,
    );
    expect(issues).toEqual([]);

    vi.doUnmock("@/lib/llm/provider");
  });

  it("repairs a plan missing a leading trigger by prepending one", async () => {
    const plan = { name: "No Trigger", description: "Forgot the trigger.", steps: [{ type: "output", label: "Done", config: {} }] };

    vi.doMock("@/lib/llm/provider", () => ({
      getProvider: () => ({ complete: () => Promise.resolve({ content: JSON.stringify(plan), usage: { promptTokens: 0, completionTokens: 0 } }) }),
    }));
    const { generateAgentFromDescription } = await import("./generate-from-description");

    const result = await generateAgentFromDescription("just an output");

    expect(result.graph.nodes[0]!.type).toBe("trigger");
    const issues = validateGraph(
      result.graph.nodes.map((node) => ({ id: node.id, type: node.type, data: node.data })),
      result.graph.edges,
    );
    expect(issues.some((issue) => issue.message.includes("no enabled trigger"))).toBe(false);

    vi.doUnmock("@/lib/llm/provider");
  });

  it("throws a specific, retryable error when the model's response isn't valid JSON", async () => {
    vi.doMock("@/lib/llm/provider", () => ({
      getProvider: () => ({ complete: () => Promise.resolve({ content: "not json at all", usage: { promptTokens: 0, completionTokens: 0 } }) }),
    }));
    const { generateAgentFromDescription } = await import("./generate-from-description");

    await expect(generateAgentFromDescription("anything")).rejects.toThrow(/usable agent plan/i);

    vi.doUnmock("@/lib/llm/provider");
  });
});
