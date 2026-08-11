import { Sparkles } from "lucide-react";
import { z } from "zod";
import { DEFAULT_GROQ_MODEL, GROQ_MODEL_IDS, getModelLabel } from "@/lib/llm/models";
import type { NodeTypeDefinition } from "../registry";

// The model id is an enum sourced from lib/llm/models.ts's GROQ_MODEL_IDS --
// no model literal appears here or anywhere else in this file, per CLAUDE.md's
// LLM provider rule ("No model name string literals outside
// lib/llm/models.ts"). B3 needs a real, editable field here for its
// multi-select-shared-property-edit gate item; wiring this to an actual
// running model call is still later Copilot-track work.
const configSchema = z.object({
  model: z.enum(GROQ_MODEL_IDS),
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
  defaultConfig: { model: DEFAULT_GROQ_MODEL, systemPrompt: "", temperature: 0.7 },
  summary: (config) =>
    config.systemPrompt ? `${getModelLabel(config.model)} — "${config.systemPrompt}"` : getModelLabel(config.model),
};
