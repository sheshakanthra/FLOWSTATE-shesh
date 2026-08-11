import { completeGroqChat, streamGroqChat, type GroqMessage } from "./groq";

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

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  signal?: AbortSignal;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
}

export type LLMChunk = { type: "token"; delta: string } | { type: "done"; content: string; usage: LLMUsage };

export interface LLMResponse {
  content: string;
  usage: LLMUsage;
}

export interface LLMProvider {
  stream(req: LLMRequest): AsyncIterable<LLMChunk>;
  complete(req: LLMRequest): Promise<LLMResponse>;
}

function toGroqMessages(messages: LLMMessage[]): GroqMessage[] {
  return messages.map((message) => ({ role: message.role, content: message.content }));
}

const groqProvider: LLMProvider = {
  stream(req) {
    return streamGroqChat({ model: req.model, messages: toGroqMessages(req.messages), temperature: req.temperature, signal: req.signal });
  },
  async complete(req) {
    const result = await completeGroqChat({
      model: req.model,
      messages: toGroqMessages(req.messages),
      temperature: req.temperature,
      signal: req.signal,
    });
    return { content: result.content, usage: result.usage };
  },
};

export function getProvider(): LLMProvider {
  return groqProvider;
}
