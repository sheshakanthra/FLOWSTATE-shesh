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

const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqUsage {
  promptTokens: number;
  completionTokens: number;
}

export type GroqStreamChunk = { type: "token"; delta: string } | { type: "done"; content: string; usage: GroqUsage };

export interface GroqChatParams {
  model: string;
  messages: GroqMessage[];
  temperature?: number;
  signal?: AbortSignal;
}

interface GroqChunkPayload {
  choices?: { delta?: { content?: string }; finish_reason?: string | null }[];
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
 */
export async function* streamGroqChat(params: GroqChatParams): AsyncGenerator<GroqStreamChunk> {
  const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
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
    }),
    signal: params.signal,
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw new Error(`Groq request failed (${response.status}): ${text.slice(0, 500)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let usage: GroqUsage = { promptTokens: 0, completionTokens: 0 };

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
