import type { HumanInLoopConfig } from "../../nodes/types/human-in-loop";
import type { NodeExecutor } from "./types";

/**
 * Real human-in-the-loop behavior — actually suspending the run and
 * waiting for a person to approve or reject through some UI — needs an
 * approval surface that doesn't exist anywhere in this codebase yet (no
 * pending-approval inbox, no notification path), and none of this
 * session's gate items exercise a pause/resume run. This executor
 * auto-approves immediately, branching exactly like Condition (only the
 * `approved` output port fires, so anything wired to `rejected` is
 * correctly marked `skipped`) so a graph containing this node type still
 * produces a coherent, fully-traced run today. A future session adding
 * real approval can replace this file's body without touching the
 * orchestrator's branch-pruning contract.
 */
export const humanInLoopExecutor: NodeExecutor<HumanInLoopConfig> = async ({ resolvedInput }) => {
  return { output: { approved: resolvedInput.request ?? null } };
};
