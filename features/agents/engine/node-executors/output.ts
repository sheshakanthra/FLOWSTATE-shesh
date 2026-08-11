import type { OutputConfig } from "../../nodes/types/output";
import type { NodeExecutor } from "./types";

/**
 * Terminal node -- `registry.ts`'s `outputNodeType.outputs` is `[]`, so
 * there's no output port to populate. The orchestrator captures a reached
 * Output node's resolved input as one of the run's final results by
 * reading the step's own recorded `input` (every step's resolved input is
 * recorded regardless of what its executor returns), not from anything
 * this function hands back -- so this executor has nothing meaningful to
 * do beyond existing as a registered no-op.
 */
export const outputExecutor: NodeExecutor<OutputConfig> = async () => {
  return { output: {} };
};
