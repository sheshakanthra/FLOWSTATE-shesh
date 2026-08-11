import { resolveUpstreamScope, type ScopeGraphEdge, type ScopeGraphNode } from "../lib/scope";

/** Every upstream node's outputs collected so far during a run, keyed by
 *  node id then port id -- the running orchestrator's single source of
 *  truth for "what has each node produced." */
export type NodeOutputs = Map<string, Record<string, unknown>>;

export interface EngineGraphEdge extends ScopeGraphEdge {
  id: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Resolves every `{{token}}` in a free-text config field (a prompt, an
 * expression) against the same upstream scope the Inspector's variable
 * autocomplete (B3, `features/agents/lib/scope.ts`) offered when the user
 * typed it -- same `resolveUpstreamScope` walk, same slugified token
 * format, so a token that autocompleted cleanly in the Inspector resolves
 * cleanly here too. A token with no matching upstream output (stale, typoed,
 * or the producing node hasn't run yet) is left as literal text rather than
 * silently dropped, since silently vanishing text is a worse failure mode
 * than a visibly wrong prompt.
 */
export function interpolateTemplate(
  template: string,
  nodeId: string,
  nodes: readonly ScopeGraphNode[],
  edges: readonly ScopeGraphEdge[],
  outputs: NodeOutputs,
): string {
  const scope = resolveUpstreamScope(nodeId, nodes, edges);
  const byToken = new Map(scope.map((variable) => [variable.token, variable]));

  return template.replace(TOKEN_PATTERN, (match, token: string) => {
    const variable = byToken.get(token);
    if (!variable) return match;
    const value = outputs.get(variable.nodeId)?.[variable.portId];
    return stringifyValue(value);
  });
}

/** Applies `interpolateTemplate` to every string value in a node's config,
 *  leaving non-string config values (numbers, booleans, enums) untouched. */
export function interpolateConfig(
  config: Record<string, unknown>,
  nodeId: string,
  nodes: readonly ScopeGraphNode[],
  edges: readonly ScopeGraphEdge[],
  outputs: NodeOutputs,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    resolved[key] = typeof value === "string" ? interpolateTemplate(value, nodeId, nodes, edges, outputs) : value;
  }
  return resolved;
}

/**
 * The *other* half of resolution: a node's directly wired input ports (an
 * LLM's `context` input connected to a Knowledge node's `results` output),
 * as opposed to a `{{token}}` typed into free text. Reads each incoming
 * edge's source node's already-produced output for that specific port.
 * Returns `undefined` for a port with no incoming edge, or whose source
 * hasn't executed (or was skipped) yet -- the caller's job to decide
 * whether that's an error.
 */
export function resolvePortInputs(
  nodeId: string,
  edges: readonly EngineGraphEdge[],
  outputs: NodeOutputs,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const edge of edges) {
    if (edge.target !== nodeId || !edge.targetHandle) continue;
    const sourceOutputs = outputs.get(edge.source);
    const value = sourceOutputs && edge.sourceHandle ? sourceOutputs[edge.sourceHandle] : undefined;
    resolved[edge.targetHandle] = value;
  }
  return resolved;
}
