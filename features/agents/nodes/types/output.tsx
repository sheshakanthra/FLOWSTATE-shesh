import { LogOut } from "lucide-react";
import { z } from "zod";
import type { NodeTypeDefinition } from "../registry";

const configSchema = z.object({
  destination: z.string(),
});

export type OutputConfig = z.infer<typeof configSchema>;

export const outputNodeType: NodeTypeDefinition<OutputConfig> = {
  id: "output",
  label: "Output",
  description: "Ends the run, sending its result somewhere.",
  icon: LogOut,
  category: "output",
  inputs: [{ id: "in", label: "input", type: "any" }],
  outputs: [],
  configSchema,
  defaultConfig: { destination: "" },
  summary: (config) => (config.destination ? `To ${config.destination}` : "No destination set"),
};
