import { describe, expect, it } from "vitest";
import { validateGraph } from "../lib/validate-graph";
import { TEMPLATES } from "./definitions";
import { instantiateTemplate } from "./instantiate";

describe("templates -- gate item 6 structural half", () => {
  it("there are exactly 6, each with a real name and description, not a placeholder", () => {
    expect(TEMPLATES).toHaveLength(6);
    for (const template of TEMPLATES) {
      expect(template.name).not.toMatch(/example|placeholder|template \d/i);
      expect(template.description.length).toBeGreaterThan(10);
      expect(template.nodes.length).toBeGreaterThan(0);
    }
  });

  it("every template's edges reference real node ids within that same template", () => {
    for (const template of TEMPLATES) {
      const nodeIds = new Set(template.nodes.map((node) => node.id));
      for (const edge of template.edges) {
        expect(nodeIds.has(edge.source), `${template.id}: edge source "${edge.source}"`).toBe(true);
        expect(nodeIds.has(edge.target), `${template.id}: edge target "${edge.target}"`).toBe(true);
      }
    }
  });

  it("every template instantiates into a graph that passes validateGraph with zero issues", () => {
    for (const template of TEMPLATES) {
      const graph = instantiateTemplate(template);
      const issues = validateGraph(graph.nodes as never, graph.edges as never);
      expect(issues, `${template.id}: ${JSON.stringify(issues)}`).toEqual([]);
    }
  });

  it("instantiating the same template twice produces two independent graphs with no shared ids", () => {
    const template = TEMPLATES[0]!;
    const first = instantiateTemplate(template);
    const second = instantiateTemplate(template);
    const firstIds = new Set((first.nodes as { id: string }[]).map((node) => node.id));
    const secondIds = (second.nodes as { id: string }[]).map((node) => node.id);
    for (const id of secondIds) expect(firstIds.has(id)).toBe(false);
    expect(first.nodes).toHaveLength(second.nodes.length);
  });
});
