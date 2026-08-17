"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CopilotMessage } from "./store";
import { Message } from "./message";

export interface MessageListProps {
  messages: CopilotMessage[];
  onEdit: (messageId: string, content: string) => void;
  onRegenerate: (messageId: string) => void;
}

/** Gate item 4's threshold for "the user has scrolled up" -- small enough
 *  that being pinned near the very bottom (a few px of rounding, a
 *  scrollbar's own slack) doesn't read as having scrolled away. */
const PIN_THRESHOLD_PX = 96;

/**
 * Session spec item 2 / gate item 8: virtualized past 60 messages, only
 * visible ones in the DOM at 200. `estimateSize` is a rough starting guess
 * -- @tanstack/react-virtual's own `measureElement` (wired below, same
 * pattern as A5's DataTable) corrects it per-row after first paint, which is
 * what a chat transcript's wildly variable message heights actually need.
 */
export function MessageList({ messages, onEdit, onRegenerate }: MessageListProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = React.useState(true);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 88,
    overscan: 8,
  });

  const lastAssistantId = React.useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index--) {
      if (messages[index]!.role === "assistant") return messages[index]!.id;
    }
    return null;
  }, [messages]);

  // Gate item 4: pinned auto-scroll follows new content (a new message, or
  // the next token of a streaming one) unless the user has scrolled up.
  React.useEffect(() => {
    if (!pinned) return;
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  });

  function handleScroll() {
    const element = scrollRef.current;
    if (!element) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    setPinned(distanceFromBottom <= PIN_THRESHOLD_PX);
  }

  function jumpToLatest() {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
    setPinned(true);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        aria-label="Conversation"
      >
        <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const message = messages[virtualItem.index];
            if (!message) return null;
            return (
              <div
                key={message.id}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualItem.start}px)` }}
                className="px-1 py-1.5"
              >
                <Message message={message} isLatestAssistant={message.id === lastAssistantId} onEdit={onEdit} onRegenerate={onRegenerate} />
              </div>
            );
          })}
        </div>
      </div>

      {!pinned ? (
        <div className="absolute inset-x-0 bottom-2 flex justify-center">
          <Button size="sm" variant="secondary" onClick={jumpToLatest} className="border-ink-500 bg-ink-200">
            <ChevronDown className="size-3.5" aria-hidden="true" />
            Jump to latest
          </Button>
        </div>
      ) : null}
    </div>
  );
}
