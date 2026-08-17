/**
 * Provider-agnostic error types for `lib/llm/`. Split into their own file
 * rather than declared in `provider.ts` (which imports `groq.ts`) or
 * `groq.ts` (which must stay the only file that knows Groq's HTTP shape) so
 * neither has to import the other to share them -- feature code catches
 * these by class, never a Groq status code or error string.
 *
 * Session spec item 8: rate limit, provider down, and context too large each
 * need their own message and recovery action. `groq.ts` is what maps a real
 * HTTP response to one of these; everything above `lib/llm/` only ever sees
 * the class.
 */
export class LLMRateLimitError extends Error {
  constructor(message = "Groq is rate-limiting requests right now.") {
    super(message);
    this.name = "LLMRateLimitError";
  }
}

export class LLMProviderUnavailableError extends Error {
  constructor(message = "Groq did not respond.") {
    super(message);
    this.name = "LLMProviderUnavailableError";
  }
}

export class LLMContextTooLargeError extends Error {
  constructor(message = "This conversation is too long for the model's context window.") {
    super(message);
    this.name = "LLMContextTooLargeError";
  }
}
