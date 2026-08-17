import { clearCancelRequested, isCancelRequested, setCancelRequested } from "@/lib/repos/copilot";

/**
 * Explicit, cooperative cancellation for /api/copilot/stream -- not
 * `request.signal`. Verified directly against this app's real dev server
 * (Next.js 15.4.6 App Router Route Handlers, this session): aborting the
 * client's `fetch()` never fires `request.signal`'s `"abort"` event on the
 * server at all -- confirmed with a listener logging on every invocation
 * across several repeated real runs, none fired, even though aborting the
 * fetch is exactly the mechanism B4's `/api/agents/[id]/run` route
 * documents relying on successfully. Whatever the platform-specific reason,
 * the upstream Groq call and the token loop consuming it never learn the
 * client left, which both fails gate item 5 outright and wastes a real,
 * billed Groq generation nothing will ever read.
 *
 * The first fix attempt was a module-level `Map<requestId, AbortController>`
 * shared between this route and a `/cancel` route via a plain import --
 * also verified, directly, not to work: a real cancel request found the map
 * empty every time, even though the streaming route had just registered
 * into it. Next.js Route Handlers in different files do not reliably share
 * module-level state (each appears to get its own bundle/module instance
 * even within one `next dev` process), so that registry silently never saw
 * the write.
 *
 * What actually works: a column on `copilot_threads` (see its own doc
 * comment in db/schema.ts) that both routes reach through the same real
 * Postgres connection instead of through Node module state. The cancel
 * route writes `requestId` into it; the streaming route polls it
 * (throttled -- real token arrival can be much faster than a Postgres round
 * trip affords checking on every single one) and self-aborts its own,
 * purely local `AbortController` the moment it sees a match.
 */
export async function markRequestCancelled(workspaceId: string, threadId: string, requestId: string): Promise<void> {
  await setCancelRequested(workspaceId, threadId, requestId);
}

export async function wasRequestCancelled(workspaceId: string, threadId: string, requestId: string): Promise<boolean> {
  return isCancelRequested(workspaceId, threadId, requestId);
}

export async function clearRequestCancellation(workspaceId: string, threadId: string, requestId: string): Promise<void> {
  await clearCancelRequested(workspaceId, threadId, requestId);
}

/** How often the streaming route is willing to spend a Postgres round trip
 *  checking for cancellation -- frequent enough to comfortably clear gate
 *  item 5's 200ms budget, far less often than real token arrival. */
export const CANCELLATION_POLL_INTERVAL_MS = 120;
