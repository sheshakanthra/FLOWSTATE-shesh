"use client";

import * as React from "react";
import { connectLiveUpdates } from "./sse-client";
import type { LiveEvent } from "./events";

export type LiveConnectionStatus = "connecting" | "connected" | "offline";

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

/** Full jitter, capped exponential -- avoids every open tab racing to
 *  reconnect at the exact same instant after a shared network blip (a
 *  real, common thundering-herd failure mode for fixed-interval retry). */
function backoffDelay(attempt: number): number {
  const exponential = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
  return Math.random() * exponential;
}

/**
 * Gate item 3: "kill the network, offline indicator appears, backoff
 * reconnect fires, on reconnect the state catches up with zero duplicate
 * cards." The first two are this hook's job; the third is cache-patch.ts's
 * -- every event is an upsert/remove keyed by id, so a reconnect's fresh
 * full snapshot (app/api/live/route.ts's own per-connection diff starting
 * from an empty map) never *duplicates* a row, it just re-confirms or
 * corrects whatever's already in the cache.
 *
 * `status` starts "connecting", flips to "connected" the moment the
 * connection actually opens, and only flips to "offline" once a connection
 * attempt has genuinely failed -- not preemptively on every scheduled
 * retry, which would make the indicator flicker through a normal, healthy
 * reconnect instead of only showing up when the network is really gone.
 */
export function useLiveConnection(workspaceSlug: string | null, onEvent: (event: LiveEvent) => void): LiveConnectionStatus {
  const [status, setStatus] = React.useState<LiveConnectionStatus>("connecting");
  const onEventRef = React.useRef(onEvent);
  onEventRef.current = onEvent;

  React.useEffect(() => {
    if (!workspaceSlug) return;

    let cancelled = false;
    let source: EventSource | null = null;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (cancelled) return;
      source = connectLiveUpdates(workspaceSlug!, {
        onEvent: (event) => onEventRef.current(event),
        onOpen: () => {
          attempt = 0;
          setStatus("connected");
        },
        onError: () => {
          // Prevents EventSource's own built-in reconnect from firing
          // alongside this one -- see sse-client.ts's doc comment. Without
          // this, a network blip would race two independent reconnect
          // timers against each other.
          source?.close();
          setStatus("offline");
          const delay = backoffDelay(attempt);
          attempt += 1;
          retryTimer = setTimeout(connect, delay);
        },
      });
    }

    connect();

    return () => {
      cancelled = true;
      source?.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [workspaceSlug]);

  return status;
}
