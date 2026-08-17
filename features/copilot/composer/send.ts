import { useMessagesStore } from "../messages/store";
import { useThreadsStore } from "../threads/store";
import type { CopilotContext } from "../context/envelope";

/**
 * The one place composer/index.tsx reaches into the thread and message
 * stores -- kept out of the component so "what happens when Send is pressed
 * with no conversation open yet" (create a thread first, then send into it)
 * has one definition rather than one per call site. Plain function, not a
 * hook: both stores are zustand, and `.getState()` is the correct way to
 * read/act on store state from an event handler rather than a render.
 */
export async function sendFromComposer(params: {
  workspaceSlug: string;
  envelope: CopilotContext;
  activeThreadId: string | null;
  content: string;
}): Promise<string> {
  let threadId = params.activeThreadId;
  if (!threadId) {
    await useThreadsStore.getState().createThread(params.workspaceSlug);
    threadId = useThreadsStore.getState().activeThreadId;
    if (!threadId) throw new Error("Couldn't start a new conversation.");
  }

  await useMessagesStore.getState().send({
    workspaceSlug: params.workspaceSlug,
    threadId,
    envelope: params.envelope,
    content: params.content,
  });

  return threadId;
}
