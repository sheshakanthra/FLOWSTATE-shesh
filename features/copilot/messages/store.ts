"use client";

import { create } from "zustand";
import type { CopilotContext } from "../context/envelope";
import { streamCopilotMessage, type StreamCitation } from "../stream/client";

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: StreamCitation[];
  createdAt: string;
  /** Set only on the one message currently receiving tokens -- everything
   *  downstream (the caret, the aria-live buffering) keys off this rather
   *  than "is this the last message," so a stopped/finished stream can't be
   *  mistaken for a live one after the fact. */
  streaming?: boolean;
}

export type StreamErrorKind = "rate_limit" | "provider_down" | "context_too_large" | "unknown";

export interface ThreadMessagesState {
  messages: CopilotMessage[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  streaming: boolean;
  streamError: { kind: StreamErrorKind; message: string } | null;
  /**
   * Bumped by every operation that will eventually write `messages` back
   * (`load`, and `runStream`'s `send`/`editAndResend`/`regenerate`/`retry`).
   * A real bug this caught: opening a brand-new thread and sending into it
   * immediately both touch the same thread's state -- the dock's own mount
   * effect calls `load()` (a real, in-flight GET, since a freshly created
   * thread's status starts "idle"), and if that GET's response resolves
   * *after* `send()` has already added optimistic messages and started
   * streaming, `load()`'s unconditional overwrite wiped them back to
   * whatever the server had at the moment the GET was issued -- empty. Each
   * operation captures the generation current when *it* starts and only
   * applies its own result if that generation is still the latest one by
   * the time its async work finishes; a newer operation having started in
   * between means this one's result is stale and gets silently dropped
   * instead of clobbering something newer.
   */
  generation: number;
}

const EMPTY_THREAD_STATE: ThreadMessagesState = {
  messages: [],
  status: "idle",
  error: null,
  streaming: false,
  streamError: null,
  generation: 0,
};

interface RunStreamParams {
  workspaceSlug: string;
  threadId: string;
  envelope: CopilotContext;
  mode: "send" | "edit" | "regenerate" | "retry";
  content?: string;
  messageId?: string;
}

interface MessagesStoreState {
  byThread: Record<string, ThreadMessagesState>;
  /** Not per-thread: only one stream is ever in flight from this dock at a
   *  time (there is exactly one composer), so a single controller is the
   *  whole of what Stop (gate item 5) needs to abort locally.
   *
   *  `activeRequestId`/`activeThreadId`/`activeWorkspaceSlug` exist
   *  alongside it because aborting this controller only tears down the
   *  *client's* fetch -- verified directly against this app's real dev
   *  server that Next's Route Handler `request.signal` never fires from
   *  that abort, so the server-side Groq call keeps running unless told to
   *  stop a different way. `stop()` below POSTs these to
   *  /api/copilot/stream/cancel, which writes them to Postgres (see
   *  features/copilot/lib/cancellation.ts for why a DB column, not
   *  in-memory state) so the still-running streaming request can see it and
   *  abort its own, purely local upstream call. */
  activeController: AbortController | null;
  activeRequestId: string | null;
  activeThreadId: string | null;
  activeWorkspaceSlug: string | null;

  load: (workspaceSlug: string, threadId: string) => Promise<void>;
  send: (params: { workspaceSlug: string; threadId: string; envelope: CopilotContext; content: string }) => Promise<void>;
  editAndResend: (params: {
    workspaceSlug: string;
    threadId: string;
    envelope: CopilotContext;
    messageId: string;
    content: string;
  }) => Promise<void>;
  regenerate: (params: {
    workspaceSlug: string;
    threadId: string;
    envelope: CopilotContext;
    messageId: string;
  }) => Promise<void>;
  /** Session spec item 8's recovery action for rate-limit/provider-down/
   *  unknown errors: nothing was persisted on a failed attempt (see the
   *  route's own "retry" branch), so retrying just re-runs the same turn --
   *  no message to delete, no new content to send. */
  retry: (params: { workspaceSlug: string; threadId: string; envelope: CopilotContext }) => Promise<void>;
  stop: () => void;
  dismissStreamError: (threadId: string) => void;
}

type Setter = (fn: (state: MessagesStoreState) => Partial<MessagesStoreState>) => void;
type Getter = () => MessagesStoreState;

function updateThread(set: Setter, threadId: string, updater: (state: ThreadMessagesState) => ThreadMessagesState) {
  set((state) => ({
    byThread: { ...state.byThread, [threadId]: updater(state.byThread[threadId] ?? EMPTY_THREAD_STATE) },
  }));
}

/** Starts a new generation for `threadId` and returns it -- call once at the
 *  start of any operation that will later write `messages` back, before its
 *  first `await`. */
function startGeneration(set: Setter, get: Getter, threadId: string): number {
  const next = (get().byThread[threadId]?.generation ?? 0) + 1;
  updateThread(set, threadId, (state) => ({ ...state, generation: next }));
  return next;
}

/** Guards a stale async result: applies `updater` only if `threadId` is
 *  still on the generation the caller started with. */
function updateThreadIfCurrent(
  set: Setter,
  get: Getter,
  threadId: string,
  myGeneration: number,
  updater: (state: ThreadMessagesState) => ThreadMessagesState,
) {
  if (get().byThread[threadId]?.generation !== myGeneration) return;
  updateThread(set, threadId, updater);
}

interface RawMessage {
  id: string;
  role: CopilotMessage["role"];
  content: string;
  citations: StreamCitation[] | null;
  createdAt: string;
}

export const useMessagesStore = create<MessagesStoreState>((set, get) => ({
  byThread: {},
  activeController: null,
  activeRequestId: null,
  activeThreadId: null,
  activeWorkspaceSlug: null,

  load: async (workspaceSlug, threadId) => {
    const myGeneration = startGeneration(set, get, threadId);
    updateThread(set, threadId, (state) => ({ ...state, status: "loading", error: null }));
    try {
      const response = await fetch(`/api/copilot/threads/${threadId}?workspaceSlug=${encodeURIComponent(workspaceSlug)}`);
      if (!response.ok) {
        updateThreadIfCurrent(set, get, threadId, myGeneration, (state) => ({
          ...state,
          status: "error",
          error: "Couldn't load this conversation. Check your connection and retry.",
        }));
        return;
      }
      const data = (await response.json()) as { messages: RawMessage[] };
      updateThreadIfCurrent(set, get, threadId, myGeneration, (state) => ({
        ...state,
        status: "ready",
        error: null,
        messages: data.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          citations: message.citations ?? [],
          createdAt: message.createdAt,
        })),
      }));
    } catch {
      updateThreadIfCurrent(set, get, threadId, myGeneration, (state) => ({
        ...state,
        status: "error",
        error: "Couldn't load this conversation. Check your connection and retry.",
      }));
    }
  },

  send: (params) => runStream(set, get, { ...params, mode: "send" }),
  editAndResend: (params) => runStream(set, get, { ...params, mode: "edit" }),
  regenerate: (params) => runStream(set, get, { ...params, mode: "regenerate" }),
  retry: (params) => runStream(set, get, { ...params, mode: "retry" }),

  stop: () => {
    const { activeController, activeRequestId, activeThreadId, activeWorkspaceSlug } = get();
    // Tears down the client's own fetch immediately (stops reading further
    // tokens) -- but see this state's own doc comment: this alone does not
    // stop the server's real Groq call, which is what the POST below is for.
    activeController?.abort();
    if (activeRequestId && activeThreadId && activeWorkspaceSlug) {
      void fetch("/api/copilot/stream/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug: activeWorkspaceSlug, threadId: activeThreadId, requestId: activeRequestId }),
      });
    }
  },

  dismissStreamError: (threadId) => {
    updateThread(set, threadId, (state) => ({ ...state, streamError: null }));
  },
}));

export function useThreadMessages(threadId: string | null): ThreadMessagesState {
  return useMessagesStore((state) => (threadId ? (state.byThread[threadId] ?? EMPTY_THREAD_STATE) : EMPTY_THREAD_STATE));
}

/**
 * The one function behind `send`/`editAndResend`/`regenerate` (session spec
 * item 7). All three are "truncate local state to the right point, add an
 * optimistic placeholder, stream tokens into it, reconcile with the server's
 * final id/content/citations" -- they only differ in *what* gets truncated
 * and whether a new user bubble is added, which is exactly what `mode`
 * decides below.
 */
async function runStream(set: Setter, get: Getter, params: RunStreamParams): Promise<void> {
  const { threadId, mode } = params;
  const placeholderId = `pending-assistant-${crypto.randomUUID()}`;
  // Only "send"/"edit" add a new user bubble -- null otherwise, since
  // "regenerate"/"retry" re-answer a user message that's already real.
  const pendingUserId = mode === "send" || mode === "edit" ? `pending-user-${crypto.randomUUID()}` : null;
  const myGeneration = startGeneration(set, get, threadId);

  updateThread(set, threadId, (state) => {
    let messages = state.messages;

    if (mode === "edit") {
      const cutIndex = messages.findIndex((message) => message.id === params.messageId);
      if (cutIndex >= 0) messages = messages.slice(0, cutIndex);
      messages = [
        ...messages,
        { id: pendingUserId!, role: "user", content: params.content ?? "", citations: [], createdAt: new Date().toISOString() },
      ];
    } else if (mode === "regenerate") {
      const cutIndex = messages.findIndex((message) => message.id === params.messageId);
      if (cutIndex >= 0) messages = messages.slice(0, cutIndex);
    } else if (mode === "retry") {
      // Nothing to truncate or add -- the failed attempt left no message
      // behind (see the route's own "retry" branch), so the last user
      // message already in `messages` is exactly what gets re-answered.
    } else {
      messages = [
        ...messages,
        { id: pendingUserId!, role: "user", content: params.content ?? "", citations: [], createdAt: new Date().toISOString() },
      ];
    }

    messages = [
      ...messages,
      { id: placeholderId, role: "assistant", content: "", citations: [], createdAt: new Date().toISOString(), streaming: true },
    ];

    // Forces "ready" regardless of whatever status this thread had a moment
    // ago: if a `load()` was still in flight (status "loading") when this
    // started, this operation's generation bump already guarantees that
    // load's eventual response gets discarded rather than applied (see
    // updateThreadIfCurrent) -- but nothing else would otherwise clear
    // "loading" back to "ready" once that happens, and the dock reads
    // `status` directly to decide whether to render "Loading conversation…"
    // or the message list.
    return { ...state, status: "ready", messages, streaming: true, streamError: null };
  });

  const controller = new AbortController();
  const requestId = crypto.randomUUID();
  set(() => ({
    activeController: controller,
    activeRequestId: requestId,
    activeThreadId: threadId,
    activeWorkspaceSlug: params.workspaceSlug,
  }));

  // Groq can stream extremely fine-grained tokens (a real observed reply
  // split "recall-scheduler" and a uuid into ~150 single-character deltas)
  // -- applying each one as its own zustand `setState` synchronously
  // storms React with far more re-renders per second than any of this
  // dock's own consumers (markdown re-parsing, the virtualizer, message.tsx's
  // own per-content effects) can absorb before the browser's next paint,
  // which is exactly the shape of update burst React's nested-update-depth
  // guard exists to catch ("Maximum update depth exceeded") -- reproduced
  // deterministically against this real response. Coalescing every delta
  // that arrives within one animation frame into a single store write is
  // also, independently, what gate item 2 ("stays at 60fps") actually asks
  // for: one commit per frame, not one per token.
  let pendingDelta = "";
  let flushHandle: number | null = null;

  function flushPendingDelta() {
    flushHandle = null;
    if (!pendingDelta) return;
    const delta = pendingDelta;
    pendingDelta = "";
    updateThreadIfCurrent(set, get, threadId, myGeneration, (state) => ({
      ...state,
      messages: state.messages.map((message) =>
        message.id === placeholderId ? { ...message, content: message.content + delta } : message,
      ),
    }));
  }

  try {
    for await (const event of streamCopilotMessage({
      workspaceSlug: params.workspaceSlug,
      threadId,
      envelope: params.envelope,
      mode,
      content: params.content,
      messageId: params.messageId,
      requestId,
      signal: controller.signal,
    })) {
      if (event.type === "token") {
        pendingDelta += event.delta;
        if (flushHandle === null) flushHandle = requestAnimationFrame(flushPendingDelta);
      } else if (event.type === "done") {
        if (flushHandle !== null) {
          cancelAnimationFrame(flushHandle);
          flushHandle = null;
          pendingDelta = "";
        }
        updateThreadIfCurrent(set, get, threadId, myGeneration, (state) => ({
          ...state,
          streaming: false,
          // Reconciles *both* optimistic ids with their real, persisted
          // ones -- the assistant placeholder (`placeholderId`) and, for
          // send/edit, the user bubble that was added right alongside it
          // (`pendingUserId`). Missing the second half of this was a real
          // bug: a user message whose id never stops starting with
          // "pending-" never renders its own action row (message.tsx's
          // `!message.id.startsWith("pending-")` guard), so Edit and resend
          // (gate item 6) silently disappeared forever, not just until
          // reload.
          messages: state.messages.map((message) => {
            if (message.id === placeholderId) {
              return { id: event.messageId, role: "assistant", content: event.content, citations: event.citations, createdAt: message.createdAt };
            }
            if (pendingUserId && message.id === pendingUserId) {
              return { ...message, id: event.userMessageId };
            }
            return message;
          }),
        }));
      } else if (event.type === "error") {
        if (flushHandle !== null) {
          cancelAnimationFrame(flushHandle);
          flushHandle = null;
          pendingDelta = "";
        }
        updateThreadIfCurrent(set, get, threadId, myGeneration, (state) => ({
          ...state,
          streaming: false,
          streamError: { kind: event.kind, message: event.message },
          messages: state.messages.filter((message) => message.id !== placeholderId),
        }));
      }
    }
  } catch (error) {
    if (flushHandle !== null) {
      cancelAnimationFrame(flushHandle);
      flushHandle = null;
      pendingDelta = "";
    }
    const isAbort = Boolean(error && typeof error === "object" && "name" in error && error.name === "AbortError");
    if (isAbort) {
      // Stop generation (gate item 5): the server persists whatever partial
      // text it had produced -- but only *after* it notices the
      // cancellation (polled server-side, up to
      // CANCELLATION_POLL_INTERVAL_MS late -- see
      // features/copilot/lib/cancellation.ts) and writes it to Postgres,
      // meaningfully after the client's own fetch already threw this
      // AbortError. A real, reproducible race: calling load() exactly once,
      // immediately, can win that race and show only the user's message,
      // with the assistant's partial reply appearing to have vanished
      // rather than merely not being written yet. Retried with a short
      // backoff instead of trusted on the first try -- reloading from the
      // server (not the client's own token buffer) is still what gives the
      // finished bubble its real id and resolved citations; this just
      // gives the server a fair chance to have finished writing first.
      updateThread(set, threadId, (state) => ({ ...state, streaming: false }));
      for (let attempt = 0; attempt < 14; attempt++) {
        await get().load(params.workspaceSlug, threadId);
        const messages = get().byThread[threadId]?.messages ?? [];
        if (messages.at(-1)?.role === "assistant") break;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } else {
      updateThreadIfCurrent(set, get, threadId, myGeneration, (state) => ({
        ...state,
        streaming: false,
        streamError: { kind: "unknown", message: error instanceof Error ? error.message : "The copilot failed to respond." },
        messages: state.messages.filter((message) => message.id !== placeholderId),
      }));
    }
  } finally {
    set((state) =>
      state.activeController === controller
        ? { activeController: null, activeRequestId: null, activeThreadId: null, activeWorkspaceSlug: null }
        : {},
    );
  }
}
