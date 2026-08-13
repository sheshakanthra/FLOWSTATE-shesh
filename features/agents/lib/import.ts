import { z } from "zod";
import { AGENT_EXPORT_VERSION, type AgentExportPayload } from "./export";

// Permissive on purpose (`.passthrough()`): a node/edge's exact shape is
// owned by `features/agents/nodes/registry.ts` and each node type's own
// `configSchema`, not by this file -- re-declaring every node type's config
// shape here would duplicate that and drift out of sync the first time a
// node type's schema changes. This validates only the structural envelope
// every node/edge must have to round-trip through the graph engine at all
// (an id, a position, a config bag) and leaves per-type config validity to
// `validate-graph.ts`, which the import route runs afterward anyway.
const nodeSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1).optional(),
    position: z.object({ x: z.number(), y: z.number() }),
    data: z
      .object({
        label: z.string(),
        config: z.record(z.unknown()),
        disabled: z.boolean().optional(),
      })
      .passthrough(),
  })
  .passthrough();

const edgeSchema = z
  .object({
    id: z.string().min(1),
    source: z.string().min(1),
    target: z.string().min(1),
    sourceHandle: z.string().nullable().optional(),
    targetHandle: z.string().nullable().optional(),
  })
  .passthrough();

const exportSchema = z.object({
  kilnExportVersion: z.literal(AGENT_EXPORT_VERSION),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  graph: z.object({
    nodes: z.array(nodeSchema),
    edges: z.array(edgeSchema),
  }),
  exportedAt: z.string().optional(),
});

export type ImportResult = { success: true; data: AgentExportPayload } | { success: false; error: string };

/**
 * The other half of gate item 7's round-trip. Returns a typed result
 * rather than throwing, matching this codebase's own `safeParse` convention
 * everywhere else a user-supplied payload is validated (route handlers'
 * request-body schemas) -- an import is exactly that: file content a user
 * picked off their own filesystem, not data this app produced a moment ago.
 */
export function parseAgentImport(raw: string): ImportResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { success: false, error: "That file isn't valid JSON." };
  }

  const result = exportSchema.safeParse(json);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    if (firstIssue?.path[0] === "kilnExportVersion") {
      return { success: false, error: "This file isn't a KILN agent export, or was exported by an incompatible version." };
    }
    const path = firstIssue?.path.join(".") || "file";
    return { success: false, error: `Invalid agent export: problem with "${path}".` };
  }

  return {
    success: true,
    data: {
      kilnExportVersion: result.data.kilnExportVersion,
      name: result.data.name,
      description: result.data.description ?? null,
      graph: result.data.graph,
      exportedAt: result.data.exportedAt ?? new Date().toISOString(),
    },
  };
}
