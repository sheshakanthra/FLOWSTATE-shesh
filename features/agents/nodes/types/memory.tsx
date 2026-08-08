import { BrainCircuit } from "lucide-react";
import { z } from "zod";
import type { NodeTypeDefinition } from "../registry";

const configSchema = z.object({
  scope: z.enum(["session", "workspace"]),
});

export type MemoryConfig = z.infer<typeof configSchema>;

export const memoryNodeType: NodeTypeDefinition<MemoryConfig> = {
  id: "memory",
  label: "Memory",
  description: "Reads and writes state that persists across steps of a run.",
  icon: BrainCircuit,
  category: "data",
  inputs: [{ id: "write", label: "write", type: "any" }],
  outputs: [{ id: "read", label: "read", type: "any" }],
  configSchema,
  defaultConfig: { scope: "session" },
  summary: (config) => (config.scope === "session" ? "Scope: this run" : "Scope: whole workspace"),
};
