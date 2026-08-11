import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { Canvas } from "../canvas";
import { Inspector } from "./index";
import { useGraphStore, type CanvasEdge, type CanvasNode } from "../store/graph-store";
import { useCanvasStore } from "../store/canvas-store";
import { getNodeType } from "../nodes/registry";

// Storybook has no `/api/agents/[id]` route handler behind it -- the
// autosave hook's PATCH would otherwise 404 on every debounce tick and
// permanently show the indicator's error state. Scoped to this file only
// (module-load side effect), matching no other story's needs today.
if (typeof window !== "undefined") {
  window.fetch = (async () => {
    // A real delay rather than resolving synchronously -- otherwise the
    // save indicator's "saving" state is too short-lived (a single
    // microtask) for anything, human or automated, to reliably observe
    // before Playwright's own polling backs off past it.
    await new Promise((resolve) => setTimeout(resolve, 700));
    return new Response(JSON.stringify({ updatedAt: new Date().toISOString() }), { status: 200 });
  }) as typeof fetch;
}

function fixtureNode(id: string, typeId: string, label: string, position: { x: number; y: number }, configOverrides = {}): CanvasNode {
  const definition = getNodeType(typeId);
  return {
    id,
    type: typeId,
    position,
    data: { label, config: { ...definition?.defaultConfig, ...configOverrides } },
  };
}

const AGENT = { name: "Insurance Verification", description: "Checks patient eligibility before each appointment.", status: "published" as const };

function Frame({ children }: { children: React.ReactNode }) {
  return <div style={{ height: 800, width: "100%", display: "flex" }}>{children}</div>;
}

function seedAndSelect(nodes: CanvasNode[], edges: CanvasEdge[], selectedIds: string[]) {
  useGraphStore.getState().setGraph(nodes, edges);
  useGraphStore.getState().setSelection(selectedIds, []);
  useCanvasStore.getState().setSelectedNodeIds(selectedIds);
}

function resetStores() {
  useGraphStore.getState().setGraph([], []);
  useCanvasStore.getState().setSelectedNodeIds([]);
}

const meta: Meta = {
  title: "Features/Agents/Inspector",
};

export default meta;
type Story = StoryObj;

/** Nothing selected -- the agent-level settings form, per session spec item 1. */
function EmptySelectionRender() {
  React.useEffect(() => {
    seedAndSelect([fixtureNode("trigger-1", "trigger", "Schedule trigger", { x: 100, y: 100 })], [], []);
    return resetStores;
  }, []);
  return (
    <Frame>
      <div style={{ flex: 1 }}>
        <Canvas />
      </div>
      <Inspector agent={AGENT} agentId="story-agent" workspaceSlug="story-workspace" />
    </Frame>
  );
}
export const EmptySelection: Story = { render: () => <EmptySelectionRender /> };

/** A single LLM node with three real upstream nodes -- exercises the
 *  Configuration section's Select/Slider/Textarea fields and variable
 *  autocomplete's in-scope-only offering (gate item 5). */
function SingleNodeRender() {
  React.useEffect(() => {
    const nodes = [
      fixtureNode("trigger-1", "trigger", "Schedule trigger", { x: 60, y: 60 }),
      fixtureNode("knowledge-1", "knowledge", "Policy docs", { x: 60, y: 220 }),
      fixtureNode("tool-1", "tool", "Eligibility API", { x: 60, y: 380 }),
      fixtureNode("llm-1", "llm", "Draft summary", { x: 420, y: 220 }),
    ];
    const edges: CanvasEdge[] = [
      { id: "e1", source: "trigger-1", sourceHandle: "out", target: "knowledge-1", targetHandle: "query" },
      { id: "e2", source: "trigger-1", sourceHandle: "out", target: "tool-1", targetHandle: "input" },
      { id: "e3", source: "knowledge-1", sourceHandle: "results", target: "llm-1", targetHandle: "context" },
      { id: "e4", source: "tool-1", sourceHandle: "output", target: "llm-1", targetHandle: "prompt" },
    ];
    seedAndSelect(nodes, edges, ["llm-1"]);
    return resetStores;
  }, []);
  return (
    <Frame>
      <div style={{ flex: 1 }}>
        <Canvas />
      </div>
      <Inspector agent={AGENT} agentId="story-agent" workspaceSlug="story-workspace" />
    </Frame>
  );
}
export const SingleNodeSelected: Story = { render: () => <SingleNodeRender /> };

/** Three LLM nodes selected together -- gate item 7: changing the shared
 *  Model field updates all three as one undoable action. */
function MultiSelectSameTypeRender() {
  React.useEffect(() => {
    const nodes = [
      fixtureNode("llm-1", "llm", "Draft A", { x: 60, y: 60 }),
      fixtureNode("llm-2", "llm", "Draft B", { x: 320, y: 60 }, { temperature: 1.2 }),
      fixtureNode("llm-3", "llm", "Draft C", { x: 580, y: 60 }),
    ];
    seedAndSelect(nodes, [], ["llm-1", "llm-2", "llm-3"]);
    return resetStores;
  }, []);
  return (
    <Frame>
      <div style={{ flex: 1 }}>
        <Canvas />
      </div>
      <Inspector agent={AGENT} agentId="story-agent" workspaceSlug="story-workspace" />
    </Frame>
  );
}
export const MultiSelectSameType: Story = { name: "Multi-select — same type", render: () => <MultiSelectSameTypeRender /> };

/** Two different node types selected together -- shows the explanatory
 *  message instead of attempting a broken shared-property form. */
function MultiSelectMixedTypesRender() {
  React.useEffect(() => {
    const nodes = [
      fixtureNode("llm-1", "llm", "Draft A", { x: 60, y: 60 }),
      fixtureNode("tool-1", "tool", "Eligibility API", { x: 320, y: 60 }),
    ];
    seedAndSelect(nodes, [], ["llm-1", "tool-1"]);
    return resetStores;
  }, []);
  return (
    <Frame>
      <div style={{ flex: 1 }}>
        <Canvas />
      </div>
      <Inspector agent={AGENT} agentId="story-agent" workspaceSlug="story-workspace" />
    </Frame>
  );
}
export const MultiSelectMixedTypes: Story = { name: "Multi-select — mixed types", render: () => <MultiSelectMixedTypesRender /> };

/** An invalid config (maxIterations violates its own positive-int schema)
 *  -- red border on canvas (NodeShell's own existing behavior) plus the
 *  Inspector's per-field error, gate item 4. */
function InvalidConfigRender() {
  React.useEffect(() => {
    seedAndSelect([fixtureNode("loop-1", "loop", "Retry loop", { x: 200, y: 150 }, { maxIterations: -3 })], [], ["loop-1"]);
    return resetStores;
  }, []);
  return (
    <Frame>
      <div style={{ flex: 1 }}>
        <Canvas />
      </div>
      <Inspector agent={AGENT} agentId="story-agent" workspaceSlug="story-workspace" />
    </Frame>
  );
}
export const InvalidConfig: Story = { render: () => <InvalidConfigRender /> };
