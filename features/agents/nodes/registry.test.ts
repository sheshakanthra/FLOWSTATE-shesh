import { render } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { Zap } from "lucide-react";
import * as React from "react";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { searchNodeTypes } from "../library/search";
import { NodeShell } from "./node-shell";
import { getNodeType, listNodeTypes, registerNodeType, type AgentNode, type NodeTypeDefinition } from "./registry";

function renderNode(definition: ReturnType<typeof getNodeType>, config: Record<string, unknown>) {
  if (!definition) throw new Error("definition not found");
  const node: AgentNode = {
    id: "test-node",
    type: definition.id,
    position: { x: 0, y: 0 },
    data: { label: definition.label, config },
  };
  return render(
    React.createElement(
      ReactFlowProvider,
      null,
      React.createElement(NodeShell, {
        id: node.id,
        type: node.type,
        data: node.data,
        selected: false,
        isConnectable: true,
        dragging: false,
        zIndex: 0,
        selectable: true,
        deletable: true,
        draggable: true,
        positionAbsoluteX: 0,
        positionAbsoluteY: 0,
        definition,
      }),
    ),
  );
}

describe("node type registry", () => {
  it("registers all ten required node types with at least one port each", () => {
    const ids = listNodeTypes()
      .map((definition) => definition.id)
      .sort();
    expect(ids).toEqual(
      [
        "condition",
        "humanInLoop",
        "knowledge",
        "llm",
        "loop",
        "memory",
        "output",
        "tool",
        "transform",
        "trigger",
      ].sort(),
    );
    for (const definition of listNodeTypes()) {
      expect(definition.inputs.length + definition.outputs.length).toBeGreaterThan(0);
    }
  });

  it("renders every registered node type through the one shared NodeShell renderer", () => {
    for (const definition of listNodeTypes()) {
      const { container, unmount } = renderNode(definition, definition.defaultConfig);
      expect(container.querySelector(`[data-node-type="${definition.id}"]`)).not.toBeNull();
      unmount();
    }
  });

  /**
   * Gate item 7: adding a node type is a matter of adding a definition
   * object, never bespoke rendering/search/listing code. Proven here by
   * registering a definition that was never mentioned anywhere else in this
   * codebase, then checking every consumer picks it up with zero special
   * casing -- listing, lookup, search (by label/category/description), and
   * NodeShell's rendering (schema parse + summary), the same path every
   * built-in type goes through.
   *
   * The React Flow `nodeTypes` map (registry.ts's `nodeTypes` export) is
   * still built once at module load from whatever was registered at that
   * point -- true for all ten shipped types, since their registration runs
   * before that map is built. A definition registered at arbitrary runtime
   * (as this test does) won't retroactively appear in that already-built
   * map; in practice a new type is always added as a file that gets
   * imported once at build time, exactly like the ten here, so this doesn't
   * arise outside of a test registering a type that was never a real file.
   * See PROGRESS.md's B2 decisions.
   */
  it("a definition registered with no other code changes is immediately live everywhere", () => {
    const configSchema = z.object({ note: z.string() });
    const definition: NodeTypeDefinition<{ note: string }> = {
      id: "test-only-widget",
      label: "Test Widget",
      description: "A definition registered purely for this test, never imported by registry.ts.",
      icon: Zap,
      category: "data",
      inputs: [{ id: "in", label: "in", type: "any" }],
      outputs: [{ id: "out", label: "out", type: "any" }],
      configSchema,
      defaultConfig: { note: "hello" },
      summary: (config) => config.note,
    };

    registerNodeType(definition);

    expect(getNodeType("test-only-widget")).toBeDefined();
    expect(listNodeTypes().some((candidate) => candidate.id === "test-only-widget")).toBe(true);
    expect(searchNodeTypes("Test Widget", listNodeTypes()).some((candidate) => candidate.id === "test-only-widget")).toBe(
      true,
    );
    expect(searchNodeTypes("registered purely", listNodeTypes()).map((candidate) => candidate.id)).toContain(
      "test-only-widget",
    );
    expect(searchNodeTypes("Data", listNodeTypes()).map((candidate) => candidate.id)).toContain("test-only-widget");

    const { container } = renderNode(getNodeType("test-only-widget"), { note: "hello" });
    expect(container.textContent).toContain("Test Widget");
    expect(container.textContent).toContain("hello");
  });
});
