import { Wrench } from "lucide-react";
import { z } from "zod";
import type { NodeTypeDefinition } from "../registry";

const configSchema = z.object({
  toolId: z.string(),
});

export type ToolConfig = z.infer<typeof configSchema>;

export const toolNodeType: NodeTypeDefinition<ToolConfig> = {
  id: "tool",
  label: "Tool",
  description: "Invokes an external tool or action with structured input.",
  icon: Wrench,
  category: "action",
  inputs: [{ id: "input", label: "input", type: "json" }],
  outputs: [{ id: "output", label: "output", type: "json" }],
  configSchema,
  defaultConfig: { toolId: "" },
  summary: (config) => (config.toolId ? config.toolId : "No tool selected"),
};
