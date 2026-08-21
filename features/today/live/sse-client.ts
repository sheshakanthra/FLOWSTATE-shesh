"use client";

import type { LiveEvent, LiveEventType } from "./events";

export interface LiveConnectionHandlers {
  onEvent: (event: LiveEvent) => void;
  onOpen?: () => void;
  onError?: () => void;
}

const EVENT_TYPES: LiveEventType[] = [
  "run_upsert",
  "run_remove",
  "priority_upsert",
  "priority_remove",
  "activity_upsert",
  "metrics_update",
];

/**
 * Opens one `/api/live` connection for `workspaceSlug`. Plain `EventSource`,
 * not a hand-rolled `fetch()` reader the way C2's `/api/copilot/stream`
 * client works -- that workaround existed only because the copilot stream
 * needed a POST body (thread id, mode, envelope); `/api/live` is GET-only
 * with everything it needs already in the query string, which is exactly
 * what `EventSource` is for.
 *
 * The browser's own automatic reconnect is deliberately defeated by
 * `reconnect.ts` (it calls `.close()` the moment `onError` fires, before
 * `EventSource` gets a chance to retry itself) -- reconnect.ts owns retry
 * timing instead, with real exponential backoff and an offline signal
 * `EventSource`'s fixed-interval `retry:` field can't express. This module
 * only opens a connection and forwards typed events; it has no opinion on
 * whether or when to reconnect.
 */
export function connectLiveUpdates(workspaceSlug: string, handlers: LiveConnectionHandlers): EventSource {
  const source = new EventSource(`/api/live?workspaceSlug=${encodeURIComponent(workspaceSlug)}`);

  source.addEventListener("open", () => handlers.onOpen?.());
  source.addEventListener("error", () => handlers.onError?.());

  for (const type of EVENT_TYPES) {
    source.addEventListener(type, (rawEvent) => {
      const messageEvent = rawEvent as MessageEvent<string>;
      try {
        const parsed = JSON.parse(messageEvent.data) as LiveEvent;
        handlers.onEvent(parsed);
      } catch {
        // A malformed frame is dropped, not fatal -- matches
        // features/copilot/stream/parser.ts's own precedent for a
        // hand-parsed SSE stream.
      }
    });
  }

  return source;
}
