"use client";

import * as React from "react";
import { Check, Copy, Pencil, RotateCcw } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { SpectralHairline } from "@/components/motion/spectral-hairline";
import { useReducedMotion } from "@/lib/motion";
import { cn, focusRing } from "@/lib/utils";
import { splitSentences } from "../lib/sentences";
import type { CopilotMessage } from "./store";
import { Markdown } from "./markdown";

/**
 * Gate item 10: under reduced motion, streamed content "appears in chunks"
 * instead of updating every token. Rather than a visual-only trick (the
 * underlying store still updates per token -- that's what drives the
 * screen-reader sentence buffering below, which has to work regardless of
 * motion preference), this simply throttles how often the *displayed* text
 * advances, snapping to the real content the instant streaming ends so
 * nothing is ever left stale.
 */
function useChunkedDisplay(content: string, streaming: boolean, reducedMotion: boolean): string {
  const [displayed, setDisplayed] = React.useState(content);
  const pendingRef = React.useRef(false);

  React.useEffect(() => {
    if (!streaming || !reducedMotion) {
      setDisplayed(content);
      return;
    }
    if (pendingRef.current) return;
    pendingRef.current = true;
    const timeout = window.setTimeout(() => {
      pendingRef.current = false;
      setDisplayed(content);
    }, 260);
    return () => window.clearTimeout(timeout);
  }, [content, streaming, reducedMotion]);

  React.useEffect(() => {
    if (!streaming) setDisplayed(content);
  }, [streaming, content]);

  return displayed;
}

/**
 * Gate item 9: "announces responses in complete sentences, not per token."
 * The live region's text is replaced with only the most recently *closed*
 * sentence each time one completes (never the running transcript, and never
 * the still-growing trailing sentence) -- the standard technique for making
 * an `aria-live` region read out incrementally instead of re-reading from
 * the top on every change. Sentence boundaries come from the same
 * splitSentences() the unsourced-claim marking in markdown.tsx uses.
 */
function useLatestClosedSentence(content: string, streaming: boolean): string {
  const sentences = React.useMemo(() => splitSentences(content), [content]);
  const closedCount = streaming ? Math.max(sentences.length - 1, 0) : sentences.length;
  const announcedRef = React.useRef(0);
  const [announced, setAnnounced] = React.useState("");

  React.useEffect(() => {
    if (content === "") announcedRef.current = 0;
  }, [content]);

  React.useEffect(() => {
    if (closedCount > announcedRef.current) {
      setAnnounced(sentences[closedCount - 1] ?? "");
      announcedRef.current = closedCount;
    }
  }, [closedCount, sentences]);

  return announced;
}

export interface MessageProps {
  message: CopilotMessage;
  /** Session spec item 6: the spectral hairline is AI content's only
   *  achromatic signal, and DESIGN.md scopes it to one instance at a time
   *  ("once per subtree") -- SpectralHairline itself warns in dev if more
   *  than one mounts simultaneously. A conversation can show many historical
   *  AI replies at once, so only the most recent assistant message carries
   *  it; that's also the one that's actually "AI at work right now" in the
   *  Shimmer/EmberEdge sense DESIGN.md's own philosophy uses ("ambient
   *  motion runs only where work is happening"), not a permanent stamp on
   *  every past reply. */
  isLatestAssistant: boolean;
  onEdit: (messageId: string, content: string) => void;
  onRegenerate: (messageId: string) => void;
}

export function Message({ message, isLatestAssistant, onEdit, onRegenerate }: MessageProps) {
  const reducedMotion = useReducedMotion();
  const displayedContent = useChunkedDisplay(message.content, Boolean(message.streaming), reducedMotion);
  const announced = useLatestClosedSentence(message.content, Boolean(message.streaming));

  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(message.content);
  const [copied, setCopied] = React.useState(false);

  if (message.role === "system") return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't copy", description: "Select the message and copy it manually.", variant: "danger" });
    }
  }

  function commitEdit() {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === message.content) {
      setDraft(message.content);
      return;
    }
    onEdit(message.id, next);
  }

  const isUser = message.role === "user";

  return (
    <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")} data-message-role={message.role}>
      {message.streaming ? (
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {announced}
        </div>
      ) : null}

      <div className={cn("flex max-w-[92%] items-start gap-2", isUser && "flex-row-reverse")}>
        <Avatar size="sm" fallback={isUser ? "You" : "AI"} className="mt-0.5 shrink-0" />

        <div
          className={cn(
            "min-w-0 flex-1 overflow-hidden rounded-md",
            isUser ? "border border-ink-400 bg-ink-200 px-3 py-2" : "bg-transparent",
          )}
        >
          {!isUser && isLatestAssistant ? <SpectralHairline className="mb-2" /> : null}

          {editing ? (
            <div className="flex flex-col gap-2">
              <Textarea
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={3}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    commitEdit();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setDraft(message.content);
                    setEditing(false);
                  }
                }}
              />
              <div className="flex items-center gap-1.5">
                <Button size="sm" onClick={commitEdit}>
                  Save &amp; resend
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDraft(message.content);
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Markdown content={displayedContent} citations={message.citations} />
              {message.streaming ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "ml-0.5 inline-block h-3.5 w-px translate-y-0.5 bg-fg-000 align-middle",
                    !reducedMotion && "animate-pulse",
                  )}
                />
              ) : null}
            </>
          )}
        </div>
      </div>

      {!editing && !message.streaming && !message.id.startsWith("pending-") ? (
        <div className={cn("flex items-center gap-0.5 pl-9", isUser && "flex-row-reverse pr-9 pl-0")}>
          <button
            type="button"
            onClick={() => void handleCopy()}
            aria-label={copied ? "Copied" : "Copy message"}
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-sm text-fg-200",
              "transition-instant transition-colors hover:bg-ink-200 hover:text-fg-000",
              focusRing,
            )}
          >
            {copied ? <Check className="size-3" aria-hidden="true" /> : <Copy className="size-3" aria-hidden="true" />}
          </button>

          {isUser ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Edit and resend"
              className={cn(
                "inline-flex size-6 items-center justify-center rounded-sm text-fg-200",
                "transition-instant transition-colors hover:bg-ink-200 hover:text-fg-000",
                focusRing,
              )}
            >
              <Pencil className="size-3" aria-hidden="true" />
            </button>
          ) : null}

          {!isUser && isLatestAssistant ? (
            <button
              type="button"
              onClick={() => onRegenerate(message.id)}
              aria-label="Regenerate response"
              className={cn(
                "inline-flex size-6 items-center justify-center rounded-sm text-fg-200",
                "transition-instant transition-colors hover:bg-ink-200 hover:text-fg-000",
                focusRing,
              )}
            >
              <RotateCcw className="size-3" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
