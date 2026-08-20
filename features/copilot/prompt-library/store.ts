"use client";

import * as React from "react";

export interface PromptRecord {
  id: string;
  title: string;
  content: string;
  authorName: string | null;
  createdAt: string;
}

interface PromptLibraryState {
  prompts: PromptRecord[];
  status: "idle" | "loading" | "ready" | "error";
}

/** Module-level external store, the same shape as `threads/store.ts` and
 *  `firing-bar/store.ts` -- workspace-shared prompts loaded once per
 *  session (not per dock open/close) and cached here so reopening the "/"
 *  menu doesn't refetch every time. */
let state: PromptLibraryState = { prompts: [], status: "idle" };
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): PromptLibraryState {
  return state;
}

const EMPTY: PromptLibraryState = { prompts: [], status: "idle" };
function getServerSnapshot(): PromptLibraryState {
  return EMPTY;
}

export async function loadPrompts(workspaceSlug: string): Promise<void> {
  if (state.status === "loading" || state.status === "ready") return;
  state = { ...state, status: "loading" };
  emit();
  try {
    const response = await fetch(`/api/copilot/prompts?workspaceSlug=${encodeURIComponent(workspaceSlug)}`);
    if (!response.ok) {
      state = { ...state, status: "error" };
      emit();
      return;
    }
    const data = (await response.json()) as { prompts: PromptRecord[] };
    state = { prompts: data.prompts, status: "ready" };
    emit();
  } catch {
    state = { ...state, status: "error" };
    emit();
  }
}

/** Gate item 8: "saving a new prompt persists workspace-wide" -- the new
 *  prompt is prepended locally from the real response (not re-fetched),
 *  same optimistic-from-server-response shape as `createPrompt`'s repo
 *  caller elsewhere in this codebase. Throws on failure so the dialog that
 *  calls this can show its own error rather than silently doing nothing. */
export async function savePrompt(workspaceSlug: string, title: string, content: string): Promise<void> {
  const response = await fetch("/api/copilot/prompts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceSlug, title, content }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Couldn't save this prompt.");
  }
  const data = (await response.json()) as { prompt: PromptRecord };
  state = { prompts: [data.prompt, ...state.prompts], status: "ready" };
  emit();
}

export function usePromptLibrary(): PromptLibraryState {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
