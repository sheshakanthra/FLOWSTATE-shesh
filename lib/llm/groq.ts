/**
 * The one file in this codebase allowed to know Groq's actual HTTP API
 * shape — CLAUDE.md's LLM provider rule ("Groq is the only provider, but
 * nothing outside `lib/llm/` may know that"). `provider.ts` is the only
 * importer; nothing else may import this file directly.
 *
 * A hand-written `fetch()` client, not the `groq-sdk` npm package: Groq's
 * chat completions API is OpenAI-compatible and small enough that a raw
 * streaming client is a few dozen lines, and `groq-sdk` isn't in CLAUDE.md's
 * approved dependency table. Verified against the real API (the key in
 * `.env.local`) that streaming responses carry `usage` two ways — once
 * nested under `x_groq.usage` on the `finish_reason` chunk, once again as a
 * final standalone chunk (`choices: []`, `usage: {...}`) when
 * `stream_options.include_usage` is requested — this client reads whichever
 * arrives, since either has the same `prompt_tokens`/`completion_tokens`.
 */

import { LLMContextTooLargeError, LLMProviderUnavailableError, LLMRateLimitError } from "./errors";

const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Maps a failed Groq response to one of `lib/llm/errors.ts`'s three typed
 * errors (session spec item 8) -- a plain `Error` for anything else, so a
 * genuinely unexpected failure still surfaces instead of being coerced into
 * one of the three named cases. Groq's error body is OpenAI-compatible
 * (`{ error: { message, type, code } }`); `code` is read first since it's
 * the more precise signal, `type`/`message` as a fallback for the cases
 * where Groq only sets one of the two.
 */
async function toGroqError(response: Response): Promise<Error> {
  const text = await response.text().catch(() => "");
  let code = "";
  let type = "";
  let message = "";
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string; type?: string; code?: string } };
    code = parsed.error?.code ?? "";
    type = parsed.error?.type ?? "";
    message = parsed.error?.message ?? "";
  } catch {
    // Not JSON (a proxy/edge error page, most likely) -- status code alone still decides below.
  }

  if (response.status === 429 || code === "rate_limit_exceeded") {
    return new LLMRateLimitError(message || undefined);
  }
  if (code === "context_length_exceeded" || /context length|maximum context/i.test(message)) {
    return new LLMContextTooLargeError(message || undefined);
  }
  if (response.status >= 500 || response.status === 503) {
    return new LLMProviderUnavailableError(message || undefined);
  }
  return new Error(message || `Groq request failed (${response.status}): ${text.slice(0, 500)}` || type);
}

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqUsage {
  promptTokens: number;
  completionTokens: number;
}

/** OpenAI-compatible function tool spec -- the shape Groq's own docs mirror
 *  verbatim. `provider.ts` is the only caller; nothing else may import this
 *  file, so this type never needs to be reasoned about outside lib/llm/. */
export interface GroqToolSpec {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface GroqToolCall {
  id: string;
  name: string;
  arguments: string;
}

export type GroqStreamChunk =
  | { type: "token"; delta: string }
  | { type: "tool_call"; id: string; name: string; arguments: string }
  | { type: "done"; content: string; usage: GroqUsage };

export interface GroqChatParams {
  model: string;
  messages: GroqMessage[];
  temperature?: number;
  signal?: AbortSignal;
  tools?: GroqToolSpec[];
  responseFormat?: "json";
}

interface GroqChunkPayload {
  choices?: {
    delta?: {
      content?: string;
      tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[];
    };
    finish_reason?: string | null;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  x_groq?: { usage?: { prompt_tokens?: number; completion_tokens?: number } };
}

function getApiKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");
  return key;
}

/**
 * Streams a chat completion token by token, yielding a final `"done"` chunk
 * carrying the full text and real token usage. Callers that only want the
 * whole response (no incremental UI) should still consume this generator
 * to completion rather than duplicating the parsing logic -- see
 * `completeGroqChat` below, which does exactly that.
 *
 * C3: when `params.tools` is set and the model chooses to call one instead
 * of replying with text, Groq's streaming deltas carry `tool_calls`
 * fragments keyed by array `index` -- an id and the function name typically
 * arrive whole on the first fragment for that index, `arguments` arrives in
 * pieces across several fragments and has to be concatenated, not replaced.
 * Accumulated per index below and flushed as one `"tool_call"` chunk each
 * once the stream ends, in index order (the order the model proposed them).
 */
export async function* streamGroqChat(params: GroqChatParams): AsyncGenerator<GroqStreamChunk> {
  let response: Response;
  try {
    response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature,
        stream: true,
        stream_options: { include_usage: true },
        tools: params.tools,
        tool_choice: params.tools ? "auto" : undefined,
        response_format: params.responseFormat === "json" ? { type: "json_object" } : undefined,
      }),
      signal: params.signal,
    });
  } catch (error) {
    // A client-initiated abort (Stop generation) surfaces here as a
    // DOMException named "AbortError" -- re-thrown as-is so callers can tell
    // it apart from a real network failure, rather than being coerced into
    // "provider down." Checked by `.name` alone, not `instanceof Error`:
    // Node/browsers make DOMException an Error subclass, but not every
    // environment's DOMException does (jsdom's, notably, does not), and an
    // abort should be recognized as an abort everywhere this code runs.
    if (error && typeof error === "object" && "name" in error && error.name === "AbortError") throw error;
    throw new LLMProviderUnavailableError();
  }

  if (!response.ok || !response.body) {
    throw await toGroqError(response);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let usage: GroqUsage = { promptTokens: 0, completionTokens: 0 };
  // Keyed by Groq's own `tool_calls[].index`, not insertion order -- a
  // fragment for index 1 can in principle arrive before index 0's is
  // complete. `id`/`name` are only ever set once (Groq sends them whole on
  // that index's first fragment); `arguments` is concatenated across every
  // fragment for that index.
  const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice("data:".length).trim();
        if (payload === "[DONE]") continue;

        let parsed: GroqChunkPayload;
        try {
          parsed = JSON.parse(payload) as GroqChunkPayload;
        } catch {
          continue;
        }

        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          content += delta;
          yield { type: "token", delta };
        }

        for (const fragment of parsed.choices?.[0]?.delta?.tool_calls ?? []) {
          const existing = toolCallBuffers.get(fragment.index);
          toolCallBuffers.set(fragment.index, {
            id: existing?.id || fragment.id || "",
            name: existing?.name || fragment.function?.name || "",
            args: (existing?.args ?? "") + (fragment.function?.arguments ?? ""),
          });
        }

        const rawUsage = parsed.usage ?? parsed.x_groq?.usage;
        if (rawUsage) {
          usage = {
            promptTokens: rawUsage.prompt_tokens ?? usage.promptTokens,
            completionTokens: rawUsage.completion_tokens ?? usage.completionTokens,
          };
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  for (const index of [...toolCallBuffers.keys()].sort((a, b) => a - b)) {
    const call = toolCallBuffers.get(index)!;
    if (!call.name) continue;
    yield { type: "tool_call", id: call.id || `call_${index}`, name: call.name, arguments: call.args };
  }

  yield { type: "done", content, usage };
}

/** Non-streaming convenience wrapper over `streamGroqChat` for callers that
 *  only need the final result (no token-by-token consumer). */
export async function completeGroqChat(params: GroqChatParams): Promise<{ content: string; usage: GroqUsage }> {
  let content = "";
  let usage: GroqUsage = { promptTokens: 0, completionTokens: 0 };
  for await (const chunk of streamGroqChat(params)) {
    if (chunk.type === "done") {
      content = chunk.content;
      usage = chunk.usage;
    }
  }
  return { content, usage };
}
