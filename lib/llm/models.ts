/**
 * The only place a Groq model id may appear as a string literal — CLAUDE.md's
 * LLM provider rule ("No model name string literals outside
 * lib/llm/models.ts"). `lib/llm/provider.ts` (the actual Groq client, behind
 * `LLMProvider`) doesn't exist yet — that's later Copilot-track work — but
 * the LLM node's config schema needs a concrete, selectable model id today
 * (B3 gate item 7), so this file exists ahead of the provider itself
 * specifically to give that field somewhere sanctioned to source its
 * literals from.
 */
export interface LlmModelOption {
  id: string;
  label: string;
}

export const GROQ_MODELS: readonly LlmModelOption[] = [
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile" },
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
  { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
  { id: "gemma2-9b-it", label: "Gemma 2 9B" },
];

export const GROQ_MODEL_IDS = GROQ_MODELS.map((model) => model.id) as [string, ...string[]];

export const DEFAULT_GROQ_MODEL: string = GROQ_MODELS[0]!.id;

export function getModelLabel(id: string): string {
  return GROQ_MODELS.find((model) => model.id === id)?.label ?? id;
}
