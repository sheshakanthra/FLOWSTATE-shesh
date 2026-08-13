import type { AgentGraphPayload } from "@/lib/repos/agents";

/** Bumped only if the shape below ever needs to change incompatibly --
 *  `import.ts`'s schema pins on this literal so an old or foreign JSON file
 *  fails with a clear "unsupported export version" message rather than a
 *  confusing downstream Zod error about a missing field. */
export const AGENT_EXPORT_VERSION = 1;

export interface AgentExportPayload {
  kilnExportVersion: typeof AGENT_EXPORT_VERSION;
  name: string;
  description: string | null;
  graph: AgentGraphPayload;
  exportedAt: string;
}

/**
 * Session spec item 7: export an agent's current draft as JSON. Pure and
 * synchronous -- no I/O of its own; the caller (a route handler or the
 * builder's export button) supplies the agent's own already-fetched
 * name/description/graph and does whatever it wants with the returned
 * object (`JSON.stringify` it into a download, hand it to a test). Exports
 * the live draft (`agents.graph_jsonb`), not a specific published version --
 * "export this agent" reads most naturally as "what I'd see if I opened it
 * in the builder right now," matching what Duplicate also copies.
 */
export function exportAgent(agent: { name: string; description: string | null; graph: AgentGraphPayload }): AgentExportPayload {
  return {
    kilnExportVersion: AGENT_EXPORT_VERSION,
    name: agent.name,
    description: agent.description,
    graph: agent.graph,
    exportedAt: new Date().toISOString(),
  };
}

export function serializeAgentExport(payload: AgentExportPayload): string {
  return JSON.stringify(payload, null, 2);
}
