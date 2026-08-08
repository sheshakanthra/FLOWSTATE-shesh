import { Repeat } from "lucide-react";
import { z } from "zod";
import type { NodeTypeDefinition } from "../registry";

const configSchema = z.object({
  maxIterations: z.number().int().positive(),
});

export type LoopConfig = z.infer<typeof configSchema>;

export const loopNodeType: NodeTypeDefinition<LoopConfig> = {
  id: "loop",
  label: "Loop",
  description: "Iterates over a list of items, up to a maximum count.",
  icon: Repeat,
  category: "flow",
  inputs: [{ id: "items", label: "items", type: "json" }],
  outputs: [
    { id: "item", label: "item", type: "json" },
    { id: "done", label: "done", type: "signal" },
  ],
  configSchema,
  defaultConfig: { maxIterations: 10 },
  summary: (config) => `Up to ${config.maxIterations} iterations`,
};
