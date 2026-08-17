import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LLMContextTooLargeError, LLMProviderUnavailableError, LLMRateLimitError } from "./errors";
import { streamGroqChat } from "./groq";

/**
 * Session spec item 8: rate limit, provider down, and context too large each
 * need their own typed error so the UI (features/copilot/composer/index.tsx)
 * can render a specific message and recovery action. This is the mapping
 * that makes that possible -- a real Groq call can't be forced into each of
 * these three failure modes on demand, so `fetch` is mocked to return the
 * exact response shapes Groq's own OpenAI-compatible API produces for each.
 */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("streamGroqChat error mapping", () => {
  beforeEach(() => {
    process.env.GROQ_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps a 429 response to LLMRateLimitError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(429, { error: { message: "Rate limit reached", type: "rate_limit_error" } })),
    );
    const generator = streamGroqChat({ model: "llama-3.3-70b-versatile", messages: [] });
    await expect(generator.next()).rejects.toBeInstanceOf(LLMRateLimitError);
  });

  it("maps a context_length_exceeded error code to LLMContextTooLargeError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(400, { error: { message: "This model's maximum context length is 8192 tokens.", code: "context_length_exceeded" } }),
      ),
    );
    const generator = streamGroqChat({ model: "llama-3.3-70b-versatile", messages: [] });
    await expect(generator.next()).rejects.toBeInstanceOf(LLMContextTooLargeError);
  });

  it("maps a 503 response to LLMProviderUnavailableError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(503, { error: { message: "Service unavailable" } })));
    const generator = streamGroqChat({ model: "llama-3.3-70b-versatile", messages: [] });
    await expect(generator.next()).rejects.toBeInstanceOf(LLMProviderUnavailableError);
  });

  it("maps a network failure (fetch itself rejecting) to LLMProviderUnavailableError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const generator = streamGroqChat({ model: "llama-3.3-70b-versatile", messages: [] });
    await expect(generator.next()).rejects.toBeInstanceOf(LLMProviderUnavailableError);
  });

  it("re-throws a client abort as-is, not as a provider error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const error = new DOMException("The operation was aborted.", "AbortError");
        throw error;
      }),
    );
    const generator = streamGroqChat({ model: "llama-3.3-70b-versatile", messages: [] });
    await expect(generator.next()).rejects.toMatchObject({ name: "AbortError" });
  });
});
