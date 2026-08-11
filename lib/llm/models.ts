/**
 * The only place a Groq model id may appear as a string literal — CLAUDE.md's
 * LLM provider rule ("No model name string literals outside
 * lib/llm/models.ts"). Feature code (the LLM node's config schema in B3, the
 * execution engine's cost accounting in B4) imports from here, never a
 * literal of its own.
 *
 * `mixtral-8x7b-32768` and `gemma2-9b-it` (this file's original B3 picks)
 * were removed this session after `GET /openai/v1/models` against the real
 * Groq API (the key in `.env.local`) confirmed both are no longer served —
 * B4's gate item 1 needs a real, successful Groq call, so a listed-but-dead
 * model isn't a hypothetical problem. Replaced with two more models
 * confirmed live in that same catalog call, `openai/gpt-oss-20b` and
 * `openai/gpt-oss-120b`, alongside the two originals that are still live.
 * Per-token pricing below is copied from that same catalog response
 * (`pricing.prompt`/`pricing.completion`, USD per token) — B4's cost
 * accounting (`lib/llm/groq.ts`) multiplies token counts by these rather
 * than hardcoding a single blended rate, since gate item 7 requires the
 * reported cost to track Groq's actual per-model billing within 5%.
 */
export interface LlmModelOption {
  id: string;
  label: string;
  /** USD per token, not per 1K/1M — Groq's own catalog reports it this way
   *  and multiplying by raw token counts avoids a unit-conversion bug. */
  promptPricePerToken: number;
  completionPricePerToken: number;
}

export const GROQ_MODELS: readonly LlmModelOption[] = [
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile", promptPricePerToken: 0.00000059, completionPricePerToken: 0.00000079 },
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant", promptPricePerToken: 0.00000005, completionPricePerToken: 0.00000008 },
  { id: "openai/gpt-oss-20b", label: "GPT OSS 20B", promptPricePerToken: 0.000000075, completionPricePerToken: 0.0000003 },
  { id: "openai/gpt-oss-120b", label: "GPT OSS 120B", promptPricePerToken: 0.00000015, completionPricePerToken: 0.0000006 },
];

export const GROQ_MODEL_IDS = GROQ_MODELS.map((model) => model.id) as [string, ...string[]];

export const DEFAULT_GROQ_MODEL: string = GROQ_MODELS[0]!.id;

export function getModelLabel(id: string): string {
  return GROQ_MODELS.find((model) => model.id === id)?.label ?? id;
}

export function getModelPricing(id: string): Pick<LlmModelOption, "promptPricePerToken" | "completionPricePerToken"> {
  const model = GROQ_MODELS.find((candidate) => candidate.id === id);
  return model ?? GROQ_MODELS[0]!;
}

/** Cost in cents, fractional -- matches `run_steps.cost_cents`'s
 *  `numeric(10,6)` column. A short test-console prompt costs well under one
 *  cent at Groq's real per-token rates; rounding to whole cents here would
 *  collapse most runs to 0 and make gate item 7's "within 5% of Groq's
 *  reported usage" comparison meaningless. Rounded to 6 decimal places
 *  (matching the column) only to avoid float noise past that precision. */
export function estimateCostCents(modelId: string, promptTokens: number, completionTokens: number): number {
  const pricing = getModelPricing(modelId);
  const usd = promptTokens * pricing.promptPricePerToken + completionTokens * pricing.completionPricePerToken;
  return Math.round(usd * 100 * 1e6) / 1e6;
}
