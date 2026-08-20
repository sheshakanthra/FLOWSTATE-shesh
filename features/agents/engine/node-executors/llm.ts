import { getProvider, type LLMMessage } from "@/lib/llm/provider";
import { estimateCostCents } from "@/lib/llm/models";
import type { LlmConfig } from "../../nodes/types/llm";
import type { NodeExecutor } from "./types";

/**
 * `systemPrompt` (already `{{token}}`-interpolated by the orchestrator
 * before this runs) is always the system message; the wired `prompt` input
 * port becomes the user message when connected, since no port currently
 * resolves to plain "text" earlier in the graph than an LLM's own response
 * (see PROGRESS.md's B4 decisions), most prompts live entirely in
 * `systemPrompt` and this falls back to a minimal default rather than
 * sending an empty user turn. The wired `context` input (a Knowledge node's
 * `results`, typically) is appended to the system message as reference
 * material, not sent as its own turn -- there's no "document" role in a
 * chat completion.
 */
export const llmExecutor: NodeExecutor<LlmConfig> = async ({ config, resolvedInput, ctx }) => {
  const context = resolvedInput.context;
  const contextBlock =
    context !== undefined && context !== null && !(Array.isArray(context) && context.length === 0)
      ? `\n\nContext:\n${typeof context === "string" ? context : JSON.stringify(context)}`
      : "";

  const messages: LLMMessage[] = [
    { role: "system", content: `${config.systemPrompt}${contextBlock}` },
    { role: "user", content: typeof resolvedInput.prompt === "string" && resolvedInput.prompt ? resolvedInput.prompt : "Proceed." },
  ];

  const provider = getProvider();
  let content = "";
  let usage = { promptTokens: 0, completionTokens: 0 };

  for await (const chunk of provider.stream({ model: config.model, messages, temperature: config.temperature, signal: ctx.signal })) {
    if (chunk.type === "token") {
      content += chunk.delta;
      ctx.onToken(chunk.delta);
    } else if (chunk.type === "done") {
      content = chunk.content;
      usage = chunk.usage;
    }
    // "tool_call" never arrives here -- this request carries no `tools`.
  }

  return {
    output: { response: content },
    model: config.model,
    inputTokens: usage.promptTokens,
    outputTokens: usage.completionTokens,
    costCents: estimateCostCents(config.model, usage.promptTokens, usage.completionTokens),
  };
};
