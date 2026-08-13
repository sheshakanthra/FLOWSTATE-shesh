import { describe, expect, it } from "vitest";
import { exportAgent, serializeAgentExport } from "./export";
import { parseAgentImport } from "./import";

const SAMPLE_GRAPH = {
  nodes: [
    {
      id: "node-1",
      type: "trigger",
      position: { x: 0, y: 0 },
      data: { label: "Trigger", config: { triggerType: "manual", schedule: "" } },
    },
    {
      id: "node-2",
      type: "llm",
      position: { x: 220, y: 0 },
      data: {
        label: "LLM",
        config: { model: "llama-3.3-70b-versatile", systemPrompt: "Say hello.", temperature: 0.5 },
      },
    },
  ],
  edges: [{ id: "edge-1", source: "node-1", sourceHandle: "out", target: "node-2", targetHandle: "prompt" }],
};

describe("export -> import round trip -- gate item 7", () => {
  it("produces an identical graph and config after export then import", () => {
    const exported = exportAgent({ name: "Test Agent", description: "A test.", graph: SAMPLE_GRAPH });
    const serialized = serializeAgentExport(exported);

    const result = parseAgentImport(serialized);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.graph).toEqual(SAMPLE_GRAPH);
    expect(result.data.name).toBe("Test Agent");
    expect(result.data.description).toBe("A test.");
  });

  it("rejects invalid JSON with a clear error, not a thrown exception", () => {
    const result = parseAgentImport("{ this is not json");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/valid JSON/i);
  });

  it("rejects a file with the wrong export version", () => {
    const result = parseAgentImport(JSON.stringify({ kilnExportVersion: 999, name: "x", graph: { nodes: [], edges: [] } }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/incompatible|export/i);
  });

  it("rejects a graph missing required node fields", () => {
    const result = parseAgentImport(
      JSON.stringify({
        kilnExportVersion: 1,
        name: "x",
        graph: { nodes: [{ id: "n1" }], edges: [] },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("preserves a null description through the round trip, not coercing it to an empty string", () => {
    const exported = exportAgent({ name: "No Description", description: null, graph: SAMPLE_GRAPH });
    const result = parseAgentImport(serializeAgentExport(exported));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.description).toBeNull();
  });
});
