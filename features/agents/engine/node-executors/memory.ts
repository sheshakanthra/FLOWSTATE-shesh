import type { MemoryConfig } from "../../nodes/types/memory";
import type { NodeExecutor } from "./types";

/**
 * In a single-pass DAG execution (every node runs at most once per run --
 * see loop.ts's decision comment for why B4 doesn't do real iteration),
 * a Memory node's `write` input and `read` output resolve within the same
 * call: there is no *later* node execution in this same run that could
 * observe an *earlier* write, since nothing re-enters an already-executed
 * node. So this executor just echoes `write` straight to `read` -- no
 * durable, cross-run key/value store exists anywhere in this codebase to
 * back real persistence for either `config.scope` value, and `ctx.memory`
 * (a per-run `Map`, see node-executors/types.ts) exists for a future
 * session that adds real loop iteration, where a later pass genuinely
 * could read what an earlier pass wrote.
 */
export const memoryExecutor: NodeExecutor<MemoryConfig> = async ({ resolvedInput }) => {
  return { output: { read: resolvedInput.write ?? null } };
};
