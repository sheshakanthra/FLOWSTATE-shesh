import { UserCheck } from "lucide-react";
import { z } from "zod";
import type { NodeTypeDefinition } from "../registry";

const configSchema = z.object({
  prompt: z.string(),
  timeoutMinutes: z.number().int().positive(),
});

export type HumanInLoopConfig = z.infer<typeof configSchema>;

export const humanInLoopNodeType: NodeTypeDefinition<HumanInLoopConfig> = {
  id: "humanInLoop",
  label: "Human in the loop",
  description: "Pauses the run for a person to approve or reject before continuing.",
  icon: UserCheck,
  category: "human",
  inputs: [{ id: "request", label: "request", type: "any" }],
  outputs: [
    { id: "approved", label: "approved", type: "signal" },
    { id: "rejected", label: "rejected", type: "signal" },
  ],
  configSchema,
  defaultConfig: { prompt: "", timeoutMinutes: 60 },
  summary: (config) => `Times out after ${config.timeoutMinutes}m`,
};
