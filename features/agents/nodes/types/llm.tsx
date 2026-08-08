import { Sparkles } from "lucide-react";
import { z } from "zod";
import type { NodeTypeDefinition } from "../registry";

// No model literal here or anywhere in this file, per CLAUDE.md's LLM
// provider rule ("No model name string literals outside lib/llm/models.ts").
// This session has no execution and no config-editing UI (B3/B4), so model
// selection is left for whichever session wires this node to lib/llm.
const configSchema = z.object({
  systemPrompt: z.string(),
  temperature: z.number().min(0).max(2),
});

export type LlmConfig = z.infer<typeof configSchema>;

export const llmNodeType: NodeTypeDefinition<LlmConfig> = {
  id: "llm",
  label: "LLM",
  description: "Calls a language model with a prompt and optional context.",
  icon: Sparkles,
  category: "ai",
  inputs: [
    { id: "prompt", label: "prompt", type: "text" },
    // Retrieved-document context (the standard RAG shape: a Knowledge
    // node's `results` output feeds straight into this), not `json` --
    // this is also what makes the spec's own "text -> document is
    // impossible" example concretely reachable: an LLM's `response`
    // (text) can't be wired into another LLM's `context` (document).
    { id: "context", label: "context", type: "document" },
  ],
  outputs: [{ id: "response", label: "response", type: "text" }],
  configSchema,
  defaultConfig: { systemPrompt: "", temperature: 0.7 },
  summary: (config) => (config.systemPrompt ? `"${config.systemPrompt}"` : `Temperature ${config.temperature}`),
};
