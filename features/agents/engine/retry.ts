/**
 * Per-node retry policy (session spec item 1). No node type's config schema
 * has a retry field of its own (adding one would be new schema surface a
 * B4-sized session shouldn't invent), so the policy is a single fixed
 * default, keyed by step kind: an `llm_call` gets one retry on a transient
 * failure (a real network blip against Groq is the actual failure mode this
 * exists for), everything else runs once. `attempt` on the `run_steps` row
 * (db/schema.ts) records which attempt actually succeeded/failed.
 */
export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = { maxAttempts: 1, baseDelayMs: 0 };
export const LLM_CALL_RETRY_POLICY: RetryPolicy = { maxAttempts: 2, baseDelayMs: 300 };

export interface RetryResult<T> {
  value: T;
  attempt: number;
}

/**
 * A cancelled run (AbortError) is never retried -- retrying past a
 * deliberate cancellation would defeat gate item 6's "aborts within 500ms."
 *
 * Deliberately not `error instanceof Error`: both `fetch()`'s own thrown
 * AbortError and the `DOMException` this file throws when `signal` is
 * already aborted are `DOMException` instances, and `DOMException` does
 * NOT extend `Error` in Node/most browser engines -- an `instanceof Error`
 * check silently fails to recognize either one, letting a cancelled run's
 * error get treated as an ordinary retriable failure instead. Caught by
 * this file's own test (`retry.test.ts`), not by inspection.
 */
export function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  policy: RetryPolicy,
  signal?: AbortSignal,
): Promise<RetryResult<T>> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      const value = await fn(attempt);
      return { value, attempt };
    } catch (error) {
      lastError = error;
      if (isAbortError(error)) throw error;
      if (attempt < policy.maxAttempts && policy.baseDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, policy.baseDelayMs * attempt));
      }
    }
  }
  throw lastError;
}
