"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Sparkles, X } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { base, instant, useReducedMotion } from "@/lib/motion";
import { useUndoShortcuts } from "@/lib/undo/shortcuts";
import { cn, focusRing } from "@/lib/utils";
import { ApprovalCard } from "../actions/approval-card";
import { Composer } from "../composer";
import { ContextChips } from "../context/chips";
import { useCopilotSnapshot, useCopilotWorkspace } from "../context/provider";
import { MessageList } from "../messages/list";
import { useMessagesStore, useThreadMessages } from "../messages/store";
import { ThreadList } from "../threads/list";
import { threadTitle, useThreadsStore } from "../threads/store";
import { suggestedPrompts } from "../suggestions";
import { DOCK_MODES, persistMode, readStoredMode, type DockMode } from "./modes";
import { useDockResize } from "./resize";

export interface CopilotDockProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Session spec item 1. The dock is positioned absolutely inside the shell
 * rather than sitting in its flex row, in all three modes.
 *
 * That is what actually delivers gate item 3 ("opening the dock causes zero
 * layout shift — measure CLS, expect 0"). A6 reserved this slot as a flex
 * child that animates from `w-0` to `w-[380px]`, which does reflow `<main>`
 * and everything inside it — the reservation kept Track C from having to
 * restructure the shell, but it could never have produced a zero-shift
 * open on its own. Compositing the dock over the page instead makes the
 * property structural: `<main>`'s box is identical whether the dock is open
 * or closed, so there is no shift to measure rather than a small one we've
 * agreed to tolerate.
 *
 * The tradeoff is that an open dock covers the right edge of the page. That
 * is the same bargain every overlay panel makes, and it's reversible in one
 * keystroke; a page that jumps every time the copilot opens is not.
 */
export function CopilotDock({ open, onClose }: CopilotDockProps) {
  const workspace = useCopilotWorkspace();
  const { envelope, entityLabel } = useCopilotSnapshot();
  const reducedMotion = useReducedMotion();
  const transition = reducedMotion ? instant : base;

  // C3 gate item 5: "⌘Z undoes an approved copilot action." The shell
  // mounts CopilotDock once, unconditionally (AnimatePresence below only
  // toggles the visible <aside>), so binding here -- not gated on `open` --
  // makes the shortcut active for the whole authenticated app, matching
  // CLAUDE.md's "undo is a platform primitive, not a text-editor feature"
  // rather than features/agents/canvas/index.tsx's own narrower precedent
  // (bound only while the canvas itself is mounted, since graph edits are
  // only ever made there). A copilot action can be approved from any page.
  useUndoShortcuts();

  const [mode, setMode] = React.useState<DockMode>("docked");
  const { size, handleProps } = useDockResize();

  const composerRef = React.useRef<HTMLTextAreaElement>(null);
  const returnFocusRef = React.useRef<HTMLElement | null>(null);
  const [draft, setDraft] = React.useState("");

  const activeThreadId = useThreadsStore((state) => state.activeThreadId);
  const setActiveThread = useThreadsStore((state) => state.setActiveThread);
  const threads = useThreadsStore((state) => state.threads);
  const threadMessagesState = useThreadMessages(activeThreadId);
  const editAndResend = useMessagesStore((state) => state.editAndResend);
  const regenerate = useMessagesStore((state) => state.regenerate);
  const approveToolCall = useMessagesStore((state) => state.approveToolCall);
  const rejectToolCall = useMessagesStore((state) => state.rejectToolCall);
  const retryToolCall = useMessagesStore((state) => state.retryToolCall);

  // Session spec item 9: threads survive reload -- messages are fetched the
  // first time a thread is opened in this session, not held anywhere
  // between page loads.
  React.useEffect(() => {
    if (activeThreadId && threadMessagesState.status === "idle") {
      void useMessagesStore.getState().load(workspace.slug, activeThreadId);
    }
  }, [activeThreadId, threadMessagesState.status, workspace.slug]);

  const activeThread = threads.find((thread) => thread.id === activeThreadId) ?? null;

  function handleEdit(messageId: string, content: string) {
    if (!activeThreadId) return;
    void editAndResend({ workspaceSlug: workspace.slug, threadId: activeThreadId, envelope, messageId, content });
  }

  function handleRegenerate(messageId: string) {
    if (!activeThreadId) return;
    void regenerate({ workspaceSlug: workspace.slug, threadId: activeThreadId, envelope, messageId });
  }

  // Persisted mode is read after mount, never during render: the dock starts
  // closed, so resolving it a tick late is invisible, and reading storage
  // during render would desync server and client markup.
  React.useEffect(() => {
    setMode(readStoredMode());
  }, []);

  const changeMode = React.useCallback((next: DockMode) => {
    setMode(next);
    persistMode(next);
  }, []);

  /** Gate item 7: focus moves into the composer on open and returns to
   *  whatever had it before on close. The element is captured at open time
   *  rather than tracked continuously — what the user wants back is the
   *  control they left, not the last thing focused inside the dock. */
  React.useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      composerRef.current?.focus();
      return;
    }
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    target?.focus();
  }, [open]);

  const prompts = suggestedPrompts(envelope, entityLabel);
  const isOverlayMode = mode === "fullscreen";

  const enterFrom = reducedMotion
    ? { opacity: 0 }
    : mode === "docked"
      ? { opacity: 0, x: "100%" }
      : mode === "floating"
        ? { opacity: 0, x: 24 }
        : { opacity: 0 };

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          key="copilot-dock"
          role="complementary"
          aria-label="Copilot"
          data-copilot-mode={mode}
          initial={enterFrom}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
          exit={enterFrom}
          transition={transition}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              onClose();
            }
          }}
          style={isOverlayMode ? undefined : { width: size }}
          className={cn(
            "absolute z-40 flex flex-col bg-ink-050 text-fg-000",
            mode === "docked" && "inset-y-0 right-0 border-l border-ink-400",
            // The one mode that is genuinely a floating layer, and so the one
            // that gets a shadow (DESIGN.md's rule 2).
            mode === "floating" && "top-4 right-4 bottom-4 rounded-lg border border-ink-400 shadow-floating",
            mode === "fullscreen" && "inset-0",
          )}
        >
          {!isOverlayMode ? (
            <div
              {...handleProps}
              aria-label="Resize copilot"
              className={cn(
                "absolute inset-y-0 left-0 z-10 w-2.5 -translate-x-1/2 cursor-ew-resize bg-transparent",
                "transition-instant transition-colors hover:bg-blue-fg/40",
                focusRing,
              )}
            />
          ) : null}

          <header className="flex h-control-height shrink-0 items-center gap-2 border-b border-ink-400 px-3">
            <Sparkles className="size-4 shrink-0 text-fg-200" aria-hidden="true" />
            <span className="text-label font-medium text-fg-000">Copilot</span>

            <div className="ml-auto flex items-center gap-0.5" role="group" aria-label="Copilot layout">
              {DOCK_MODES.map((option) => {
                const Icon = option.icon;
                const active = option.id === mode;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => changeMode(option.id)}
                    aria-pressed={active}
                    aria-label={option.label}
                    title={option.label}
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-sm text-fg-200",
                      "transition-instant transition-colors hover:bg-ink-200 hover:text-fg-000",
                      active && "bg-ink-200 text-fg-000",
                      focusRing,
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close copilot"
              className={cn(
                "inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-200",
                "transition-instant transition-colors hover:bg-ink-200 hover:text-fg-000",
                focusRing,
              )}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </header>

          {activeThreadId ? (
            <div
              data-thread-id={activeThreadId}
              className={cn("flex min-h-0 flex-1 flex-col gap-1.5 p-2", mode === "fullscreen" && "mx-auto w-full max-w-3xl")}
            >
              <div className="flex items-center gap-1.5 px-1 pb-1">
                <button
                  type="button"
                  onClick={() => setActiveThread(null)}
                  aria-label="Back to conversations"
                  className={cn(
                    "inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-200",
                    "transition-instant transition-colors hover:bg-ink-200 hover:text-fg-000",
                    focusRing,
                  )}
                >
                  <ArrowLeft className="size-3.5" aria-hidden="true" />
                </button>
                <span className="truncate text-label font-medium text-fg-000">
                  {activeThread ? threadTitle(activeThread) : "Conversation"}
                </span>
              </div>

              {threadMessagesState.status === "loading" ? (
                <p className="px-2 text-meta text-fg-200">Loading conversation…</p>
              ) : threadMessagesState.status === "error" ? (
                <p className="px-2 text-meta text-red-fg">{threadMessagesState.error}</p>
              ) : (
                <MessageList messages={threadMessagesState.messages} onEdit={handleEdit} onRegenerate={handleRegenerate} />
              )}
            </div>
          ) : (
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3",
                // Fullscreen is the one mode with room to breathe; the column
                // stays readable instead of stretching a 14px body across a
                // 2560px display.
                mode === "fullscreen" && "mx-auto w-full max-w-3xl",
              )}
            >
              <ThreadList workspaceSlug={workspace.slug} />
              <Separator />
              <EmptyConversation
                prompts={prompts}
                onPick={(prompt) => {
                  setDraft(prompt);
                  composerRef.current?.focus();
                }}
              />
            </div>
          )}

          <div
            className={cn(
              "flex shrink-0 flex-col gap-2 border-t border-ink-400 p-3",
              mode === "fullscreen" && "mx-auto w-full max-w-3xl",
            )}
          >
            <AnimatePresence>
              {activeThreadId && threadMessagesState.toolCall ? (
                <ApprovalCard
                  toolCall={threadMessagesState.toolCall}
                  onApprove={() => void approveToolCall({ workspaceSlug: workspace.slug, threadId: activeThreadId })}
                  onReject={() => void rejectToolCall({ workspaceSlug: workspace.slug, threadId: activeThreadId })}
                  onRetry={() => void retryToolCall({ workspaceSlug: workspace.slug, threadId: activeThreadId })}
                />
              ) : null}
            </AnimatePresence>
            <ContextChips />
            <Composer
              workspaceSlug={workspace.slug}
              envelope={envelope}
              threadId={activeThreadId}
              draft={draft}
              onDraftChange={setDraft}
              composerRef={composerRef}
              placeholder={`Ask about ${entityLabel ?? "this workspace"}…`}
            />
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * Session spec item 6. Three suggested prompts derived from the live
 * envelope, so the empty state on an agent build page never reads like the
 * empty state on `/today`.
 */
function EmptyConversation({ prompts, onPick }: { prompts: string[]; onPick: (prompt: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-label font-medium text-fg-000">Ask about what you&apos;re looking at</span>
        <p className="text-meta text-fg-100">
          The copilot already has the context shown below the composer. Start with one of these, or write your own.
        </p>
      </div>
      <ul className="flex flex-col gap-1.5" aria-label="Suggested prompts">
        {prompts.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              data-copilot-suggestion
              onClick={() => onPick(prompt)}
              className={cn(
                "w-full rounded-md border border-ink-400 bg-ink-100 px-3 py-2 text-left text-body text-fg-100",
                "transition-instant transition-colors hover:border-ink-500 hover:text-fg-000",
                focusRing,
              )}
            >
              {prompt}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
