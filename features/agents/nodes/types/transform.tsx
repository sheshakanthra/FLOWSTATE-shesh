import { Shuffle } from "lucide-react";
import { z } from "zod";
import type { NodeTypeDefinition } from "../registry";

const configSchema = z.object({
  expression: z.string(),
});

export type TransformConfig = z.infer<typeof configSchema>;

// Inputs/outputs are `any` on purpose -- a Transform node's whole job is
// reshaping arbitrary data, so the port type system can't (and shouldn't)
// know its input/output shapes. Per the spec's own note: resist adding a
// sixth port type to solve this; validate specifics in config instead.
export const transformNodeType: NodeTypeDefinition<TransformConfig> = {
  id: "transform",
  label: "Transform",
  description: "Maps input data to a new shape using an expression.",
  icon: Shuffle,
  category: "data",
  inputs: [{ id: "input", label: "input", type: "any" }],
  outputs: [{ id: "output", label: "output", type: "any" }],
  configSchema,
  defaultConfig: { expression: "" },
  summary: (config) => (config.expression ? config.expression : "No expression set"),
};
