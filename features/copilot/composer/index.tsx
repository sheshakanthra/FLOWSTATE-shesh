"use client";

import * as React from "react";
import { AlertTriangle, Send as SendIcon, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CopilotContext } from "../context/envelope";
import { useMessagesStore, useThreadMessages, type StreamErrorKind } from "../messages/store";
import { useThreadsStore } from "../threads/store";
import { sendFromComposer } from "./send";

/** Session spec / gate item 7: each of the three named error types (plus a
 *  catch-all) gets its own message and its own recovery action -- never a
 *  bare "Something went wrong." */
const ERROR_COPY: Record<StreamErrorKind, { title: string; description: string; actionLabel: string }> = {
  rate_limit: {
    title: "Groq is rate-limiting requests",
    description: "Too many requests went out too quickly. Wait a moment and try again.",
    actionLabel: "Retry",
  },
  provider_down: {
    title: "Groq didn't respond",
    description: "The model provider is unreachable right now. Try again in a moment.",
    actionLabel: "Retry",
  },
  context_too_large: {
    title: "This conversation is too long",
    description: "There's too much history for the model to read at once. Start a new conversation to keep going.",
    actionLabel: "Start a new conversation",
  },
  unknown: {
    title: "The copilot couldn't respond",
    description: "Something unexpected happened on the last request. Try again.",
    actionLabel: "Retry",
  },
};

export interface ComposerProps {
  workspaceSlug: string;
  envelope: CopilotContext;
  threadId: string | null;
  draft: string;
  onDraftChange: (value: string) => void;
  composerRef: React.Ref<HTMLTextAreaElement>;
  placeholder?: string;
}

/**
 * Session spec items 1/7/8: the text input, Send/Stop toggle, and the one
 * error surface for the whole turn. Enter sends, Shift+Enter inserts a
 * newline -- the composer never sends on its own; every mutation runs
 * through features/copilot/messages/store.ts, which is what actually talks
 * to app/api/copilot/stream/route.ts.
 *
 * Sending with no thread open yet creates one first (send.ts) and writes it
 * into useThreadsStore's `activeThreadId` -- the dock already subscribes to
 * that store, so it switches from the thread list to the message view on
 * its own; the composer doesn't need to separately tell its parent a new
 * thread now exists.
 */
export function Composer({ workspaceSlug, envelope, threadId, draft, onDraftChange, composerRef, placeholder }: ComposerProps) {
  const { streaming, streamError } = useThreadMessages(threadId);
  const stop = useMessagesStore((state) => state.stop);
  const retry = useMessagesStore((state) => state.retry);
  const dismissStreamError = useMessagesStore((state) => state.dismissStreamError);
  const createThread = useThreadsStore((state) => state.createThread);
  const [sending, setSending] = React.useState(false);

  async function handleSend() {
    const content = draft.trim();
    if (!content || streaming || sending) return;
    onDraftChange("");
    setSending(true);
    try {
      await sendFromComposer({ workspaceSlug, envelope, activeThreadId: threadId, content });
    } finally {
      setSending(false);
    }
  }

  async function handleErrorAction(kind: StreamErrorKind) {
    if (kind === "context_too_large") {
      await createThread(workspaceSlug);
      return;
    }
    if (!threadId) return;
    await retry({ workspaceSlug, threadId, envelope });
  }

  const canStop = streaming;
  const sendDisabled = sending || !draft.trim();

  return (
    <div className="flex flex-col gap-2">
      {streamError ? (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-red-line bg-red-bg px-3 py-2">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-red-fg" aria-hidden="true" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-label font-medium text-red-fg">{ERROR_COPY[streamError.kind].title}</p>
            <p className="text-meta text-fg-100">{ERROR_COPY[streamError.kind].description}</p>
            <div className="mt-0.5 flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => void handleErrorAction(streamError.kind)}>
                {ERROR_COPY[streamError.kind].actionLabel}
              </Button>
              <button
                type="button"
                onClick={() => threadId && dismissStreamError(threadId)}
                className="text-meta text-fg-200 underline-offset-2 transition-instant hover:text-fg-000 hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Textarea
        ref={composerRef}
        rows={3}
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void handleSend();
          }
        }}
        aria-label="Ask the copilot"
        placeholder={placeholder ?? "Ask about what you're looking at…"}
        disabled={sending}
      />

      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-meta text-fg-200", canStop && "animate-pulse")} id="copilot-send-hint">
          {canStop ? "Generating…" : "Enter to send, Shift+Enter for a new line."}
        </p>
        {canStop ? (
          <Button size="sm" variant="secondary" onClick={stop}>
            <Square className="size-3" aria-hidden="true" />
            Stop
          </Button>
        ) : (
          <Button size="sm" onClick={() => void handleSend()} disabled={sendDisabled} aria-describedby="copilot-send-hint">
            <SendIcon className="size-3.5" aria-hidden="true" />
            Send
          </Button>
        )}
      </div>
    </div>
  );
}
