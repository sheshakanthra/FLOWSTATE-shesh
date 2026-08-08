import * as React from "react";
import type { LucideIcon } from "lucide-react";
import type { Node, NodeProps, NodeTypes } from "@xyflow/react";
import type { z } from "zod";
import type { PortDef } from "../lib/port-types";
import { triggerNodeType } from "./types/trigger";
import { llmNodeType } from "./types/llm";
import { toolNodeType } from "./types/tool";
import { conditionNodeType } from "./types/condition";
import { loopNodeType } from "./types/loop";
import { memoryNodeType } from "./types/memory";
import { knowledgeNodeType } from "./types/knowledge";
import { transformNodeType } from "./types/transform";
import { outputNodeType } from "./types/output";
import { humanInLoopNodeType } from "./types/human-in-loop";
import { NodeShell } from "./node-shell";

export type NodeCategory = "trigger" | "ai" | "action" | "flow" | "data" | "output" | "human";

export const NODE_CATEGORY_LABELS: Record<NodeCategory, string> = {
  trigger: "Triggers",
  ai: "AI",
  action: "Actions",
  flow: "Flow control",
  data: "Data",
  output: "Output",
  human: "Human",
};

/**
 * One declarative definition per node type -- id, label, icon, category,
 * ports, config schema, default config, and a one-line summary formatter.
 * Nothing here renders anything: NodeShell (via `buildNodeTypes` below) is
 * the single generic renderer for every registered type, so a type file
 * never needs a component of its own.
 */
export interface NodeTypeDefinition<TConfig extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  category: NodeCategory;
  inputs: PortDef[];
  outputs: PortDef[];
  configSchema: z.ZodType<TConfig>;
  defaultConfig: TConfig;
  summary: (config: TConfig) => string;
}

export type AnyNodeTypeDefinition = NodeTypeDefinition<Record<string, unknown>>;

export interface AgentNodeData extends Record<string, unknown> {
  label: string;
  config: Record<string, unknown>;
  disabled?: boolean;
}

export type AgentNode = Node<AgentNodeData, string>;

const registry = new Map<string, AnyNodeTypeDefinition>();

/**
 * A node's `type` string is the only link between a graph node and its
 * definition, so definitions of different `TConfig` shapes necessarily share
 * one untyped-at-rest Map once registered. The cast below is the single,
 * contained point where that happens -- it's sound in practice because a
 * definition's `configSchema`/`summary` are only ever applied to config
 * objects that came from that same definition (see node-shell.tsx, which
 * always calls `configSchema.safeParse` before `summary`, looked up via the
 * node's own `type`), never to another type's config.
 */
export function registerNodeType<TConfig extends Record<string, unknown>>(
  definition: NodeTypeDefinition<TConfig>,
): void {
  registry.set(definition.id, definition as unknown as AnyNodeTypeDefinition);
}

export function getNodeType(id: string): AnyNodeTypeDefinition | undefined {
  return registry.get(id);
}

export function listNodeTypes(): AnyNodeTypeDefinition[] {
  return Array.from(registry.values());
}

// The one place that has to know about every node type file -- adding an
// eleventh type means adding its import + a registration call here, plus the
// new type file. Nothing else in the codebase special-cases a node type by
// id: rendering (NodeShell), the library panel, search, ports, and
// copy/paste/duplicate all consume `listNodeTypes()`/`getNodeType()`
// generically. See PROGRESS.md's B2 decisions for the registry test that
// proves that generic-consumption property.
//
// Registered one call at a time, not via a `.forEach` over a shared array --
// each definition has its own `TConfig`, and collecting them into one array
// first would force TypeScript to infer a single `TConfig` for the whole
// array (a union), which `registerNodeType`'s generic can't satisfy for
// every member at once.
registerNodeType(triggerNodeType);
registerNodeType(llmNodeType);
registerNodeType(toolNodeType);
registerNodeType(conditionNodeType);
registerNodeType(loopNodeType);
registerNodeType(memoryNodeType);
registerNodeType(knowledgeNodeType);
registerNodeType(transformNodeType);
registerNodeType(outputNodeType);
registerNodeType(humanInLoopNodeType);

function buildNodeComponent(definition: AnyNodeTypeDefinition) {
  const RegisteredNode = React.memo(function RegisteredNode(props: NodeProps<AgentNode>) {
    return React.createElement(NodeShell, { ...props, definition });
  });
  RegisteredNode.displayName = `Node(${definition.id})`;
  return RegisteredNode;
}

function buildNodeTypes(): NodeTypes {
  const map: NodeTypes = {};
  for (const definition of listNodeTypes()) {
    map[definition.id] = buildNodeComponent(definition);
  }
  return map;
}

/** Passed straight to `<ReactFlow nodeTypes={...}>` -- built once at module
 *  load from whatever is registered above. */
export const nodeTypes: NodeTypes = buildNodeTypes();

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/** Flow-position + type id in, a ready-to-insert node out, with the type's
 *  default config -- the shared factory behind the library panel's
 *  click-to-insert and drag-to-canvas, the empty state's "Add a trigger", and
 *  the context menu's "Add node". */
export function createNode(
  typeId: string,
  position: { x: number; y: number },
  overrides?: Partial<AgentNodeData>,
): AgentNode {
  const definition = getNodeType(typeId);
  if (!definition) throw new Error(`Unknown node type: ${typeId}`);
  return {
    id: generateId("node"),
    type: typeId,
    position,
    data: { label: definition.label, config: { ...definition.defaultConfig }, ...overrides },
  };
}

/** Clones a set of nodes with new, collision-free ids, preserving type and
 *  config, anchored so the first node lands at `anchor` -- shared by ⌘V,
 *  ⌘D, and the context menu's "Paste". */
export function cloneNodes(nodes: AgentNode[], anchor: { x: number; y: number }): AgentNode[] {
  const first = nodes[0];
  if (!first) return [];
  const originX = first.position.x;
  const originY = first.position.y;
  return nodes.map((node) => ({
    id: generateId("node"),
    type: node.type,
    position: {
      x: anchor.x + (node.position.x - originX),
      y: anchor.y + (node.position.y - originY),
    },
    data: { ...node.data, config: { ...node.data.config } },
    selected: false,
  }));
}

export function generateEdgeId(): string {
  return generateId("edge");
}
