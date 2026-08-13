/**
 * A template's graph shape mirrors `db/seed.ts`'s `buildRecallSchedulerGraph`
 * exactly (plain object literals, not `registry.ts`'s `createNode` factory)
 * for the same reason: these are hand-authored, not built through canvas
 * interaction, and every edge still has to respect real port-type
 * compatibility (`features/agents/lib/port-types.ts`) since the graph gets
 * validated and actually run, not just displayed.
 */
export interface TemplateNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: { label: string; config: Record<string, unknown> };
}

export interface TemplateEdge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  /** One sentence, shown on the gallery card. */
  description: string;
  nodes: TemplateNode[];
  edges: TemplateEdge[];
}
