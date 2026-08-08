import { GitBranch } from "lucide-react";
import { z } from "zod";
import type { NodeTypeDefinition } from "../registry";

const configSchema = z.object({
  expression: z.string(),
});

export type ConditionConfig = z.infer<typeof configSchema>;

export const conditionNodeType: NodeTypeDefinition<ConditionConfig> = {
  id: "condition",
  label: "Condition",
  description: "Branches the run based on a boolean expression.",
  icon: GitBranch,
  category: "flow",
  inputs: [{ id: "in", label: "input", type: "any" }],
  outputs: [
    { id: "true", label: "true", type: "signal" },
    { id: "false", label: "false", type: "signal" },
  ],
  configSchema,
  defaultConfig: { expression: "" },
  summary: (config) => (config.expression ? config.expression : "No expression set"),
};
