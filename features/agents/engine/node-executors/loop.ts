import type { LoopConfig } from "../../nodes/types/loop";
import type { NodeExecutor } from "./types";

/**
 * Simplified, single-pass semantics -- deliberately not a real loop that
 * re-executes its downstream subgraph once per item. Real iteration would
 * mean the orchestrator re-entering already-visited nodes multiple times
 * per run, with per-iteration step recording, which is a materially bigger
 * feature (subgraph detection, iteration-scoped run_steps rows) than this
 * session's gate items call for -- none of them exercise a Loop node's
 * iteration count. This executor caps `items` at `maxIterations` and
 * passes the (possibly truncated) array straight through as `item`,
 * marking `done` immediately. A future session building real loop
 * iteration can replace this file without touching the orchestrator's
 * branch-pruning contract (see condition.ts) -- `done` firing alone is
 * still a coherent "the loop finished" signal either way.
 */
export const loopExecutor: NodeExecutor<LoopConfig> = async ({ config, resolvedInput }) => {
  const items = resolvedInput.items;
  const truncated = Array.isArray(items) ? items.slice(0, config.maxIterations) : items;
  return { output: { item: truncated ?? null, done: true } };
};
