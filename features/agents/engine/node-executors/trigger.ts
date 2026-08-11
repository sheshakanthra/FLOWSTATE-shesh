import type { TriggerConfig } from "../../nodes/types/trigger";
import type { NodeExecutor } from "./types";

/** The only executor that reads `ctx.runInput` instead of `resolvedInput`
 *  -- a trigger has no input ports (registry.ts's `triggerNodeType.inputs`
 *  is `[]`), so its "input" is whatever the test console's input form
 *  posted for this run, not anything wired from another node. */
export const triggerExecutor: NodeExecutor<TriggerConfig> = async ({ ctx }) => {
  return { output: { out: ctx.runInput ?? null } };
};
