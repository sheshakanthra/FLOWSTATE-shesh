import { BookOpen } from "lucide-react";
import { z } from "zod";
import type { NodeTypeDefinition } from "../registry";

const configSchema = z.object({
  sourceId: z.string(),
  topK: z.number().int().positive(),
});

export type KnowledgeConfig = z.infer<typeof configSchema>;

export const knowledgeNodeType: NodeTypeDefinition<KnowledgeConfig> = {
  id: "knowledge",
  label: "Knowledge",
  description: "Retrieves relevant documents from a knowledge source.",
  icon: BookOpen,
  category: "data",
  inputs: [{ id: "query", label: "query", type: "text" }],
  outputs: [{ id: "results", label: "results", type: "document" }],
  configSchema,
  defaultConfig: { sourceId: "", topK: 5 },
  summary: (config) => (config.sourceId ? `${config.sourceId} · top ${config.topK}` : "No source selected"),
};
