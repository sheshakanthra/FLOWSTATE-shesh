"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { base, instant, useReducedMotion } from "@/lib/motion";
import { cn, focusRing } from "@/lib/utils";
import { ContextChips } from "../context/chips";
import { useCopilotSnapshot, useCopilotWorkspace } from "../context/provider";
import { ThreadList } from "../threads/list";
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

  const [mode, setMode] = React.useState<DockMode>("docked");
  const { size, handleProps } = useDockResize();

  const composerRef = React.useRef<HTMLTextAreaElement>(null);
  const returnFocusRef = React.useRef<HTMLElement | null>(null);
  const [draft, setDraft] = React.useState("");

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
            <EmptyConversation prompts={prompts} onPick={(prompt) => {
              setDraft(prompt);
              composerRef.current?.focus();
            }} />
          </div>

          <div
            className={cn(
              "flex shrink-0 flex-col gap-2 border-t border-ink-400 p-3",
              mode === "fullscreen" && "mx-auto w-full max-w-3xl",
            )}
          >
            <ContextChips />
            <Textarea
              ref={composerRef}
              rows={3}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label="Ask the copilot"
              placeholder={`Ask about ${entityLabel ?? "this workspace"}…`}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-meta text-fg-200" id="copilot-send-hint">
                {draft.trim()
                  ? "Context below is live — replies arrive with streaming."
                  : "⌘J closes the copilot."}
              </p>
              <Button size="sm" disabled aria-describedby="copilot-send-hint">
                Send
              </Button>
            </div>
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
