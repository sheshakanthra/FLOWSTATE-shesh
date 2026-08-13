import { getNodeType } from "../nodes/registry";

/** Structural shape only -- deliberately not `AgentNode`/`CanvasEdge`
 *  (@xyflow/react types), so this stays importable from a Route Handler
 *  (the publish route re-validates server-side) without pulling in any
 *  client-only dependency. */
export interface ValidatableNode {
  id: string;
  type?: string;
  data: { label: string; config: Record<string, unknown>; disabled?: boolean };
}

export interface ValidatableEdge {
  source: string;
  target: string;
}

export interface ValidationIssue {
  /** `null` for a graph-wide issue (no trigger, empty graph) that isn't any
   *  one node's fault -- the publish dialog only makes node-scoped issues
   *  clickable-to-focus (gate item 5), since a null nodeId has nothing on
   *  canvas to focus. */
  nodeId: string | null;
  message: string;
}

/**
 * Publish-time validation (session spec item 5: "validation results, and
 * any unresolved errors... publishing is blocked while validation fails").
 * Deliberately framework-free and synchronous -- called both from the
 * publish dialog (against the live draft in `graph-store`, for instant
 * feedback before the user even clicks Publish) and from the publish route
 * handler (the authoritative check; a client-side pass is a UX nicety, not
 * the real gate -- see the route's own comment on why it re-validates).
 *
 * Checks, deliberately not more: an empty graph; every node's own config
 * against its type's `configSchema` (the same check `NodeShell`'s
 * `isInvalid` badge already runs per-node, just collected here); a disabled
 * node's own config is still validated (a disabled node still exists on the
 * published snapshot; re-enabling it later shouldn't surface a
 * config problem for the first time post-publish); at least one enabled
 * trigger node (a graph with no way to ever start isn't publishable); and a
 * full-graph cycle check (the live canvas already prevents creating one on
 * connect -- B2 -- but an imported or template-instantiated graph never
 * passes through that connect-time gate, so this is the backstop for those
 * paths specifically, not a redundant re-check of normal editing).
 */
export function validateGraph(nodes: ValidatableNode[], edges: ValidatableEdge[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (nodes.length === 0) {
    issues.push({ nodeId: null, message: "This agent has no nodes yet." });
    return issues;
  }

  let hasEnabledTrigger = false;
  for (const node of nodes) {
    const definition = node.type ? getNodeType(node.type) : undefined;
    if (!definition) {
      issues.push({ nodeId: node.id, message: `"${node.data.label}" has an unknown node type.` });
      continue;
    }
    if (definition.id === "trigger" && node.data.disabled !== true) hasEnabledTrigger = true;

    const result = definition.configSchema.safeParse(node.data.config);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const field = firstIssue?.path.join(".") || "configuration";
      issues.push({ nodeId: node.id, message: `"${node.data.label}" has an invalid ${field}.` });
    }
  }

  if (!hasEnabledTrigger) {
    issues.push({ nodeId: null, message: "This agent has no enabled trigger node, so it can never start a run." });
  }

  const cycle = findAnyCycle(nodes.map((node) => node.id), edges);
  if (cycle) {
    const labelOf = (id: string) => nodes.find((node) => node.id === id)?.data.label ?? id;
    issues.push({ nodeId: cycle[0] ?? null, message: `This graph has a cycle: ${cycle.map(labelOf).join(" → ")}.` });
  }

  return issues;
}

/** Plain DFS cycle detection over the whole graph -- `cycle-detect.ts`'s
 *  `findCycle` is purpose-built for "would adding this one candidate edge
 *  close a cycle," not "does this already-assembled graph have one," so
 *  this is a small, separate, equally dependency-free algorithm rather than
 *  a forced reuse. */
function findAnyCycle(nodeIds: string[], edges: ValidatableEdge[]): string[] | null {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.source);
    if (list) list.push(edge.target);
    else adjacency.set(edge.source, [edge.target]);
  }

  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  function visit(nodeId: string): string[] | null {
    state.set(nodeId, "visiting");
    stack.push(nodeId);
    for (const next of adjacency.get(nodeId) ?? []) {
      const nextState = state.get(next);
      if (nextState === "visiting") {
        const cycleStart = stack.indexOf(next);
        return [...stack.slice(cycleStart), next];
      }
      if (!nextState) {
        const found = visit(next);
        if (found) return found;
      }
    }
    stack.pop();
    state.set(nodeId, "done");
    return null;
  }

  for (const nodeId of nodeIds) {
    if (!state.has(nodeId)) {
      const found = visit(nodeId);
      if (found) return found;
    }
  }
  return null;
}
