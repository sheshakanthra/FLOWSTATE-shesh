import type { ToolConfig } from "../../nodes/types/tool";
import type { NodeExecutor } from "./types";

/**
 * No tool registry exists anywhere in this codebase yet (that's C3's job --
 * "Tool registry, previews, approval," explicitly a later Copilot-track
 * session), so there is nothing real for a Tool node to call. This
 * executor is a deterministic stand-in: it echoes its resolved input back
 * inside a small envelope naming which `toolId` it "ran," rather than
 * either throwing (which would make every graph containing a Tool node
 * fail unconditionally) or fabricating a plausible-looking fake result
 * (which would misrepresent what actually happened during a real run).
 */
export const toolExecutor: NodeExecutor<ToolConfig> = async ({ config, resolvedInput }) => {
  return {
    output: {
      output: {
        toolId: config.toolId || null,
        input: resolvedInput.input ?? null,
        note: "No tool registry is wired up yet -- this input was echoed, not actually sent anywhere.",
      },
    },
  };
};
