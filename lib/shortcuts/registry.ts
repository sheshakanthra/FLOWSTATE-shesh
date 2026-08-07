"use client";

import * as React from "react";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

const CHORD_TIMEOUT_MS = 900;

export interface GlobalShortcutHandlers {
  onToggleSidebar: () => void;
  onToggleCopilot: () => void;
  onShowOverlay: () => void;
  onNavigateToday: () => void;
  onNavigateAgents: () => void;
}

/**
 * The one raw `document` keydown listener behind every global shortcut
 * except ⌘K — CommandPalette already owns that listener itself (an A3
 * decision this session was flagged to either lift or leave; left as-is,
 * since a second listener toggling the same open state would just
 * double-fire). Each handler is also registered as a Command via
 * components/ui/command-palette's registerCommands (see
 * components/shell/shell.tsx) so ⌘K surfaces the same actions with their
 * key chips — that registration is what makes these "the A3 registry"'s
 * shortcuts; this hook is only the raw keyboard dispatch.
 */
export function useGlobalShortcuts(handlers: GlobalShortcutHandlers): void {
  const handlersRef = React.useRef(handlers);
  handlersRef.current = handlers;

  React.useEffect(() => {
    let chordArmed = false;
    let chordTimer: ReturnType<typeof setTimeout> | null = null;

    function disarm() {
      chordArmed = false;
      if (chordTimer) clearTimeout(chordTimer);
      chordTimer = null;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;

      const mod = event.metaKey || event.ctrlKey;

      if (mod && event.key === "\\") {
        event.preventDefault();
        handlersRef.current.onToggleSidebar();
        return;
      }
      if (mod && event.key.toLowerCase() === "j") {
        event.preventDefault();
        handlersRef.current.onToggleCopilot();
        return;
      }
      if (!mod && event.key === "?") {
        event.preventDefault();
        handlersRef.current.onShowOverlay();
        return;
      }

      if (chordArmed) {
        disarm();
        if (event.key === "a") {
          event.preventDefault();
          handlersRef.current.onNavigateAgents();
        } else if (event.key === "t") {
          event.preventDefault();
          handlersRef.current.onNavigateToday();
        }
        return;
      }

      if (!mod && event.key === "g") {
        chordArmed = true;
        chordTimer = setTimeout(disarm, CHORD_TIMEOUT_MS);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      disarm();
    };
  }, []);
}
