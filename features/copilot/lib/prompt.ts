import { buildCopilotSystemPrompt } from "@/lib/llm/prompts/copilot";
import type { LLMMessage } from "@/lib/llm/provider";
import type { CopilotContext } from "../context/envelope";
import type { RetrievedRecord } from "./retrieve";

export interface PromptMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/** Bounded so a long thread doesn't grow the request without limit -- the
 *  model still sees the most recent turns, which is what gives "context too
 *  large" (gate item 7) a real, if rare, trigger condition rather than an
 *  error path that only exists on paper. */
const MAX_HISTORY_MESSAGES = 24;

/** Prior assistant turns are replayed with their `[cite:ID]` markers
 *  stripped. Two reasons: the model doesn't need to see its own citation
 *  syntax to hold a conversation, and an id cited three turns ago may not be
 *  in *this* turn's retrieved set -- leaving the marker in would invite the
 *  model to copy a now-stale citation forward instead of treating each
 *  answer's citations as scoped to what was just retrieved for it. */
function stripCitationMarkers(content: string): string {
  return content.replace(/\[cite:[^\]]+\]/g, "").replace(/[ \t]{2,}/g, " ").trim();
}

/**
 * Assembles the full message array the LLM provider receives: one system
 * message (context envelope + retrieved records + citation rules) followed
 * by the thread's own history. `history` is expected to already include the
 * latest user turn -- this function only prepends the system prompt, it
 * never appends anything of its own.
 */
export function buildCopilotPrompt(params: {
  workspaceName: string;
  envelope: CopilotContext;
  retrieved: RetrievedRecord[];
  history: PromptMessage[];
}): LLMMessage[] {
  const system = buildCopilotSystemPrompt({
    workspaceName: params.workspaceName,
    envelope: params.envelope,
    retrieved: params.retrieved,
  });

  const recentHistory = params.history.slice(-MAX_HISTORY_MESSAGES);

  return [
    { role: "system", content: system },
    ...recentHistory.map((message) => ({
      role: message.role,
      content: message.role === "assistant" ? stripCitationMarkers(message.content) : message.content,
    })),
  ];
}
