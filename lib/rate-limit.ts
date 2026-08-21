/**
 * The marketing hero's demo limiter (E1 gate item 4: "3 runs per IP, then a
 * soft gate"). Deliberately in-memory, module-scoped, process-lifetime --
 * this is a soft, UX-facing nudge toward sign-up, not a security control, so
 * there's no case here for a shared/persistent store (Redis, a DB table)
 * that isn't in CLAUDE.md's stack table anyway. A restart clears every
 * visitor's count, which is an acceptable tradeoff for what this gates.
 */

export const DEMO_RATE_LIMIT = 3;

const attemptsByIp = new Map<string, number>();

/** `x-forwarded-for` may carry a comma-separated chain (client, then each
 *  proxy hop) -- the first entry is the original client. Falls back to
 *  `x-real-ip`, then a constant so local dev (no proxy headers at all)
 *  still gets one consistent bucket instead of every request looking like a
 *  fresh, never-before-seen visitor. */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export interface RateLimitResult {
  allowed: boolean;
  /** The attempt number this call represents (1-indexed) when allowed;
   *  the count already on file (>= DEMO_RATE_LIMIT) when not. */
  attempt: number;
}

/** Call once per demo submission (from `/api/demo/generate`). The first
 *  `DEMO_RATE_LIMIT` calls for a given IP succeed and increment; every call
 *  after that is refused without incrementing further, so the count doesn't
 *  keep climbing past what the UI needs to know. */
export function consumeDemoAttempt(ip: string): RateLimitResult {
  const current = attemptsByIp.get(ip) ?? 0;
  if (current >= DEMO_RATE_LIMIT) {
    return { allowed: false, attempt: current };
  }
  const next = current + 1;
  attemptsByIp.set(ip, next);
  return { allowed: true, attempt: next };
}

/** Read-only check for `/api/demo/run` -- that route never increments (a
 *  run is always paired 1:1 with the generate call that already consumed
 *  the attempt), it just refuses to execute for an IP that's already over
 *  the line, in case it's ever called without a preceding generate. */
export function isDemoRateLimited(ip: string): boolean {
  return (attemptsByIp.get(ip) ?? 0) >= DEMO_RATE_LIMIT;
}

/** Test-only reset -- module state persists across test cases in the same
 *  process otherwise. */
export function __resetDemoRateLimitForTests(): void {
  attemptsByIp.clear();
}
