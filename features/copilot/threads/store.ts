"use client";

import { create } from "zustand";
import { toast } from "@/components/ui/toast";

export interface CopilotThreadSummary {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ThreadsStatus = "idle" | "loading" | "ready" | "error";

interface ThreadsState {
  threads: CopilotThreadSummary[];
  activeThreadId: string | null;
  status: ThreadsStatus;
  error: string | null;

  load: (workspaceSlug: string) => Promise<void>;
  createThread: (workspaceSlug: string) => Promise<void>;
  renameThread: (workspaceSlug: string, threadId: string, title: string) => Promise<void>;
  deleteThread: (workspaceSlug: string, threadId: string) => Promise<void>;
  setActiveThread: (threadId: string | null) => void;
}

const UNTITLED = "New conversation";

/**
 * Thread list state (session spec item 5). Mutations are optimistic with a
 * real rollback, per CLAUDE.md — the list snaps back to its previous value
 * and says what failed, rather than leaving a rename that only exists in
 * this tab.
 *
 * Creating is the one deliberate exception: the server mints the thread id,
 * and a temporary client-side id would have to be swapped out underneath
 * whatever already selected it. It's also the one mutation that can't
 * destroy anything by failing.
 *
 * Deletion is not registered with `useUndoable`. There's no server-side
 * restore for a deleted thread, and "undo" that re-created the row under a
 * fresh id would be a convincing-looking lie — the list would look restored
 * while every id that referred to the old thread had silently changed. The
 * list asks for confirmation instead (see list.tsx).
 */
export const useThreadsStore = create<ThreadsState>((set, get) => ({
  threads: [],
  activeThreadId: null,
  status: "idle",
  error: null,

  load: async (workspaceSlug) => {
    set({ status: "loading", error: null });
    try {
      const response = await fetch(`/api/copilot/threads?workspaceSlug=${encodeURIComponent(workspaceSlug)}`);
      if (!response.ok) {
        set({ status: "error", error: "Couldn't load your conversations. Check your connection and retry." });
        return;
      }
      const data = (await response.json()) as { threads: CopilotThreadSummary[] };
      set({ threads: data.threads, status: "ready", error: null });
    } catch {
      set({ status: "error", error: "Couldn't load your conversations. Check your connection and retry." });
    }
  },

  createThread: async (workspaceSlug) => {
    const response = await fetch("/api/copilot/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceSlug, title: UNTITLED }),
    });
    if (!response.ok) {
      toast({
        title: "Couldn't start a conversation",
        description: "The request didn't reach the server. Try again in a moment.",
        variant: "danger",
      });
      return;
    }
    const data = (await response.json()) as { thread: CopilotThreadSummary };
    set((state) => ({
      threads: [data.thread, ...state.threads],
      activeThreadId: data.thread.id,
      status: "ready",
    }));
  },

  renameThread: async (workspaceSlug, threadId, title) => {
    const previous = get().threads;
    set({ threads: previous.map((thread) => (thread.id === threadId ? { ...thread, title } : thread)) });

    const response = await fetch(`/api/copilot/threads/${threadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceSlug, title }),
    });
    if (!response.ok) {
      set({ threads: previous });
      toast({
        title: "Couldn't rename this conversation",
        description: "Its previous name has been restored. Try again in a moment.",
        variant: "danger",
      });
    }
  },

  deleteThread: async (workspaceSlug, threadId) => {
    const previous = get().threads;
    const wasActive = get().activeThreadId === threadId;
    set({
      threads: previous.filter((thread) => thread.id !== threadId),
      activeThreadId: wasActive ? null : get().activeThreadId,
    });

    const response = await fetch(`/api/copilot/threads/${threadId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceSlug }),
    });
    if (!response.ok) {
      set({ threads: previous, activeThreadId: wasActive ? threadId : get().activeThreadId });
      toast({
        title: "Couldn't delete this conversation",
        description: "It's still here. Try again in a moment.",
        variant: "danger",
      });
    }
  },

  setActiveThread: (activeThreadId) => set({ activeThreadId }),
}));

export function threadTitle(thread: CopilotThreadSummary): string {
  return thread.title?.trim() || UNTITLED;
}
