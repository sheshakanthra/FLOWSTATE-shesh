import { streamGroqChat, type GroqMessage, type GroqToolSpec } from "./groq";

// Re-exported, not just thrown internally: CLAUDE.md's rule is "feature code
// imports getProvider() and nothing else" from this file specifically --
// lib/llm/errors.ts still exists only so groq.ts and this file can share the
// classes without one importing the other, but a catch block outside
// lib/llm/ should never need to reach into errors.ts directly.
export { LLMContextTooLargeError, LLMProviderUnavailableError, LLMRateLimitError } from "./errors";

/**
 * The interface CLAUDE.md names exactly ("lib/llm/provider.ts"): feature
 * code imports `getProvider()` and these types, never `groq.ts` or a model
 * literal, directly. Swapping providers is a one-file change confined to
 * this file's `getProvider()` body.
 */
export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * C3's tool registry (features/copilot/tools/) hands the provider a plain
 * name/description/JSON-schema triple per tool -- the same shape every
 * OpenAI-compatible function-calling API (Groq included) wants, so this
 * stays a direct pass-through rather than an abstraction over one. Feature
 * code builds these from a tool definition's own Zod schema by hand (no
 * `zod-to-json-schema` -- not in CLAUDE.md's dependency table), never from
 * Groq's SDK types.
 */
export interface LLMToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** A tool invocation the model asked for. `arguments` is the raw JSON text
 *  the model produced -- the caller (features/copilot/tools/registry.ts's
 *  consumer) parses and validates it against that tool's own Zod schema
 *  rather than trusting it's well-formed. */
export interface LLMToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  signal?: AbortSignal;
  /** Omit for a normal conversational call. When present, the model may
   *  reply with text as usual, or call one of these instead (see
   *  `LLMChunk`'s `tool_call` variant / `LLMResponse.toolCalls`) -- never
   *  both is assumed at the seams above this file. */
  tools?: LLMToolSpec[];
  /** Asks the model for a raw JSON object back, no prose -- used for the
   *  agent-graph-generation call (features/agents/generation/), which needs
   *  a parseable structure, not a tool call (there's nothing to "call," the
   *  model's whole job that turn is producing the JSON). */
  responseFormat?: "json";
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
}

export type LLMChunk =
  | { type: "token"; delta: string }
  | { type: "tool_call"; toolCall: LLMToolCall }
  | { type: "done"; content: string; usage: LLMUsage };

export interface LLMResponse {
  content: string;
  usage: LLMUsage;
  toolCalls?: LLMToolCall[];
}

export interface LLMProvider {
  stream(req: LLMRequest): AsyncIterable<LLMChunk>;
  complete(req: LLMRequest): Promise<LLMResponse>;
}

function toGroqMessages(messages: LLMMessage[]): GroqMessage[] {
  return messages.map((message) => ({ role: message.role, content: message.content }));
}

function toGroqTools(tools: LLMToolSpec[] | undefined): GroqToolSpec[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((tool) => ({
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));
}

/** `GroqStreamChunk`'s tool-call variant is flat (`{id, name, arguments}`,
 *  matching Groq's own wire shape); `LLMChunk`'s nests the same three fields
 *  under `toolCall` -- the provider-agnostic shape a second provider's own
 *  adapter would produce the same way. This is the one place that reshapes
 *  between them. */
async function* mapGroqStream(params: Parameters<typeof streamGroqChat>[0]): AsyncGenerator<LLMChunk> {
  for await (const chunk of streamGroqChat(params)) {
    if (chunk.type === "tool_call") {
      yield { type: "tool_call", toolCall: { id: chunk.id, name: chunk.name, arguments: chunk.arguments } };
    } else {
      yield chunk;
    }
  }
}

const groqProvider: LLMProvider = {
  stream(req) {
    return mapGroqStream({
      model: req.model,
      messages: toGroqMessages(req.messages),
      temperature: req.temperature,
      signal: req.signal,
      tools: toGroqTools(req.tools),
      responseFormat: req.responseFormat,
    });
  },
  async complete(req) {
    const toolCalls: LLMToolCall[] = [];
    let content = "";
    let usage: LLMUsage = { promptTokens: 0, completionTokens: 0 };
    for await (const chunk of streamGroqChat({
      model: req.model,
      messages: toGroqMessages(req.messages),
      temperature: req.temperature,
      signal: req.signal,
      tools: toGroqTools(req.tools),
      responseFormat: req.responseFormat,
    })) {
      if (chunk.type === "tool_call") toolCalls.push(chunk);
      else if (chunk.type === "done") {
        content = chunk.content;
        usage = chunk.usage;
      }
    }
    return { content, usage, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
  },
};

export function getProvider(): LLMProvider {
  return groqProvider;
}
