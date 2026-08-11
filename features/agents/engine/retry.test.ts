import { describe, expect, it } from "vitest";
import { withRetry, type RetryPolicy } from "./retry";

describe("withRetry", () => {
  it("returns on the first successful attempt without retrying", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        return "ok";
      },
      { maxAttempts: 3, baseDelayMs: 0 },
    );
    expect(result).toEqual({ value: "ok", attempt: 1 });
    expect(calls).toBe(1);
  });

  it("retries after a failure and succeeds within maxAttempts", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 2) throw new Error("transient");
        return "recovered";
      },
      { maxAttempts: 3, baseDelayMs: 0 },
    );
    expect(result).toEqual({ value: "recovered", attempt: 2 });
    expect(calls).toBe(2);
  });

  it("throws the last error once maxAttempts is exhausted", async () => {
    let calls = 0;
    const policy: RetryPolicy = { maxAttempts: 2, baseDelayMs: 0 };
    await expect(
      withRetry(async () => {
        calls += 1;
        throw new Error(`fail ${calls}`);
      }, policy),
    ).rejects.toThrow("fail 2");
    expect(calls).toBe(2);
  });

  it("never retries an aborted (cancelled) run", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new DOMException("Aborted", "AbortError");
        },
        { maxAttempts: 3, baseDelayMs: 0 },
      ),
    ).rejects.toThrow();
    expect(calls).toBe(1);
  });

  it("refuses to start a new attempt once the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          return "should not run";
        },
        { maxAttempts: 3, baseDelayMs: 0 },
        controller.signal,
      ),
    ).rejects.toThrow();
    expect(calls).toBe(0);
  });
});
