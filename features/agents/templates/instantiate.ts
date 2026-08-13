import type { AgentGraphPayload } from "@/lib/repos/agents";
import type { TemplateDefinition } from "./types";

/**
 * A template's own node/edge ids (`"trigger"`, `"llm"`, ...) are stable and
 * readable for the definition files themselves, but two different agents
 * created from the same template must not share literal node ids -- so this
 * mints fresh ones at instantiation time and rewrites every edge to match,
 * the same id-regeneration shape `registry.ts`'s `cloneNodes` already
 * established for copy/paste. Returns a plain `AgentGraphPayload`
 * (`{nodes, edges}` as `unknown[]`), the same at-rest shape
 * `agents.graph_jsonb` already stores -- not `@xyflow/react`'s `Node`/`Edge`
 * types, since this needs to run equally well from a server-side route
 * handler (creating a new agent from a template) as from client code.
 */
export function instantiateTemplate(template: TemplateDefinition): AgentGraphPayload {
  const idMap = new Map<string, string>();
  for (const node of template.nodes) {
    idMap.set(node.id, `node-${crypto.randomUUID()}`);
  }

  const nodes = template.nodes.map((node) => ({
    id: idMap.get(node.id)!,
    type: node.type,
    position: { ...node.position },
    data: { label: node.data.label, config: { ...node.data.config } },
  }));

  const edges = template.edges.map((edge) => ({
    id: `edge-${crypto.randomUUID()}`,
    source: idMap.get(edge.source)!,
    sourceHandle: edge.sourceHandle,
    target: idMap.get(edge.target)!,
    targetHandle: edge.targetHandle,
  }));

  return { nodes, edges };
}
