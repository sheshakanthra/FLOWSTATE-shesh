"use client";

import * as React from "react";
import { Check, MessageSquarePlus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, focusRing } from "@/lib/utils";
import { formatTimestamp } from "@/features/agents/lib/format";
import { threadTitle, useThreadsStore, type CopilotThreadSummary } from "./store";

export interface ThreadListProps {
  workspaceSlug: string;
}

/**
 * Session spec item 5: thread list, new thread, rename, delete. Loads on
 * mount rather than being handed server-rendered data — the dock lives in
 * the shell, above every route, so there's no page-level Server Component
 * that could fetch this without refetching it on every navigation.
 */
export function ThreadList({ workspaceSlug }: ThreadListProps) {
  const threads = useThreadsStore((state) => state.threads);
  const status = useThreadsStore((state) => state.status);
  const error = useThreadsStore((state) => state.error);
  const activeThreadId = useThreadsStore((state) => state.activeThreadId);
  const load = useThreadsStore((state) => state.load);
  const createThread = useThreadsStore((state) => state.createThread);

  React.useEffect(() => {
    if (status === "idle") void load(workspaceSlug);
  }, [status, load, workspaceSlug]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <h3 className="text-meta font-medium tracking-wide text-fg-200 uppercase">Conversations</h3>
        <Button size="sm" variant="secondary" onClick={() => void createThread(workspaceSlug)}>
          <MessageSquarePlus className="size-3.5" aria-hidden="true" />
          New
        </Button>
      </div>

      {status === "loading" ? (
        <ul className="flex flex-col gap-1" aria-busy="true" aria-label="Loading conversations">
          {[0, 1, 2].map((index) => (
            <li key={index}>
              <Skeleton className="h-9 w-full" />
            </li>
          ))}
        </ul>
      ) : null}

      {status === "error" ? (
        <div className="flex flex-col items-start gap-2 rounded-md border border-red-line bg-red-bg px-3 py-2">
          <p className="text-meta text-red-fg">{error}</p>
          <Button size="sm" variant="secondary" onClick={() => void load(workspaceSlug)}>
            Retry
          </Button>
        </div>
      ) : null}

      {status === "ready" && threads.length === 0 ? (
        <p className="px-1 text-meta text-fg-200">
          No conversations yet. Start one to keep a thread of what you asked and what the copilot changed.
        </p>
      ) : null}

      {threads.length > 0 ? (
        <ul className="flex flex-col gap-0.5 overflow-y-auto" aria-label="Conversations">
          {threads.map((thread) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              workspaceSlug={workspaceSlug}
              active={thread.id === activeThreadId}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ThreadRow({
  thread,
  workspaceSlug,
  active,
}: {
  thread: CopilotThreadSummary;
  workspaceSlug: string;
  active: boolean;
}) {
  const setActiveThread = useThreadsStore((state) => state.setActiveThread);
  const renameThread = useThreadsStore((state) => state.renameThread);
  const deleteThread = useThreadsStore((state) => state.deleteThread);

  const [mode, setMode] = React.useState<"idle" | "renaming" | "confirming-delete">("idle");
  const [draft, setDraft] = React.useState(() => threadTitle(thread));
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (mode === "renaming") inputRef.current?.select();
  }, [mode]);

  function commitRename() {
    const next = draft.trim();
    setMode("idle");
    if (!next || next === threadTitle(thread)) {
      setDraft(threadTitle(thread));
      return;
    }
    void renameThread(workspaceSlug, thread.id, next);
  }

  if (mode === "renaming") {
    return (
      <li className="flex items-center gap-1 py-0.5">
        <Input
          ref={inputRef}
          value={draft}
          autoFocus
          aria-label={`Rename ${threadTitle(thread)}`}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitRename();
            } else if (event.key === "Escape") {
              event.preventDefault();
              setDraft(threadTitle(thread));
              setMode("idle");
            }
          }}
          className="h-8 text-label"
        />
        <Button size="icon" variant="ghost" aria-label="Save name" onClick={commitRename} className="size-8 shrink-0">
          <Check className="size-3.5" aria-hidden="true" />
        </Button>
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-1">
      <button
        type="button"
        onClick={() => setActiveThread(thread.id)}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex min-w-0 flex-1 flex-col items-start rounded-sm px-2 py-1.5 text-left",
          "transition-instant transition-colors hover:bg-ink-200",
          active && "bg-ink-200",
          focusRing,
        )}
      >
        <span className="w-full truncate text-label text-fg-000">{threadTitle(thread)}</span>
        <span className="text-meta text-fg-200">{formatTimestamp(new Date(thread.updatedAt))}</span>
      </button>

      {mode === "confirming-delete" ? (
        <span className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              setMode("idle");
              void deleteThread(workspaceSlug, thread.id);
            }}
          >
            Delete
          </Button>
          <Button size="icon" variant="ghost" aria-label="Keep conversation" onClick={() => setMode("idle")} className="size-8">
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        </span>
      ) : (
        // Always rendered, never hover-gated: a control that only exists on
        // mouse-over is unreachable by keyboard and invisible on touch.
        // Opacity lifts on hover *and* on focus-within so the row stays calm
        // without the actions being conditionally mounted.
        <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-instant transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Rename ${threadTitle(thread)}`}
            onClick={() => {
              setDraft(threadTitle(thread));
              setMode("renaming");
            }}
            className="size-8"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Delete ${threadTitle(thread)}`}
            onClick={() => setMode("confirming-delete")}
            className="size-8"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        </span>
      )}
    </li>
  );
}
