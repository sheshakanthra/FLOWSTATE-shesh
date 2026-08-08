/**
 * Pure graph algorithm, no React/@xyflow dependency -- given the edges that
 * already exist and one candidate edge someone is trying to add, decides
 * whether adding it would close a cycle, and if so, names every node on that
 * cycle in visual order so the caller can put real node labels in an error
 * message ("This would create a cycle: Trigger -> LLM -> Condition -> Trigger.").
 */
export interface GraphEdgeLike {
  source: string;
  target: string;
}

export interface ConnectionCandidate {
  source: string;
  target: string;
}

/**
 * A self-loop (source === target) is trivially a one-node cycle -- handled
 * first since the BFS below assumes source !== target.
 *
 * Otherwise: adding source -> target creates a cycle iff `target` can already
 * reach `source` via existing edges. BFS from `target` looking for `source`,
 * tracking the path taken, gives back exactly the loop the new edge would
 * close.
 */
export function findCycle(
  edges: readonly GraphEdgeLike[],
  candidate: ConnectionCandidate,
  nodeLabels: ReadonlyMap<string, string>,
): string[] | null {
  const labelOf = (id: string) => nodeLabels.get(id) ?? id;

  if (candidate.source === candidate.target) {
    return [labelOf(candidate.source), labelOf(candidate.source)];
  }

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.source);
    if (list) list.push(edge.target);
    else adjacency.set(edge.source, [edge.target]);
  }

  const visited = new Set<string>([candidate.target]);
  const queue: string[][] = [[candidate.target]];

  while (queue.length > 0) {
    const path = queue.shift() as string[];
    const last = path[path.length - 1] as string;

    if (last === candidate.source) {
      return [candidate.source, ...path].map(labelOf);
    }

    for (const next of adjacency.get(last) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }

  return null;
}
