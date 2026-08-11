import { getNodeType } from "../nodes/registry";
import type { PortType } from "./port-types";

export interface ScopeGraphNode {
  id: string;
  type?: string;
  data: { label: string };
}

export interface ScopeGraphEdge {
  source: string;
  target: string;
}

export interface ScopeVariable {
  nodeId: string;
  nodeLabel: string;
  portId: string;
  portLabel: string;
  type: PortType;
  /** The literal text a {{...}} autocomplete insertion writes -- unique
   *  across the returned list even when two upstream nodes share a label. */
  token: string;
}

function slugify(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "node";
}

/**
 * Pure, framework-free upstream walk -- no React, no @xyflow/react, no
 * zustand -- so it's independently testable and reusable by the automation
 * builder later, per the session spec's own note.
 *
 * Walks backward from `nodeId` over `edges` (an edge's `target` is the
 * downstream side, so "upstream" means following `target === current` back
 * to each `source`), visiting every ancestor transitively -- not just direct
 * predecessors -- and collecting each ancestor's registered output ports as
 * candidate variables. `nodeId` itself and anything not reachable by
 * walking backward (siblings, downstream nodes, disconnected nodes) never
 * appear in the result. A `visited` set guards against a cycle turning this
 * into an infinite walk -- the canvas rejects cycles on connect (see
 * validation.ts), but this function doesn't get to assume that always held.
 */
export function resolveUpstreamScope(
  nodeId: string,
  nodes: readonly ScopeGraphNode[],
  edges: readonly ScopeGraphEdge[],
): ScopeVariable[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const visited = new Set<string>([nodeId]);
  const queue: string[] = [nodeId];
  const ancestorIds: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const edge of edges) {
      if (edge.target !== current) continue;
      if (visited.has(edge.source)) continue;
      visited.add(edge.source);
      ancestorIds.push(edge.source);
      queue.push(edge.source);
    }
  }

  const usedTokens = new Set<string>();
  const variables: ScopeVariable[] = [];

  for (const ancestorId of ancestorIds) {
    const node = nodesById.get(ancestorId);
    if (!node?.type) continue;
    const definition = getNodeType(node.type);
    if (!definition) continue;

    const baseSlug = slugify(node.data.label);
    for (const port of definition.outputs) {
      let token = `${baseSlug}.${port.id}`;
      let suffix = 2;
      while (usedTokens.has(token)) {
        token = `${baseSlug}_${suffix}.${port.id}`;
        suffix += 1;
      }
      usedTokens.add(token);
      variables.push({
        nodeId: ancestorId,
        nodeLabel: node.data.label,
        portId: port.id,
        portLabel: port.label,
        type: port.type,
        token,
      });
    }
  }

  return variables;
}
