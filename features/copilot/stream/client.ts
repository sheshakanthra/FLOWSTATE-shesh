import type { CopilotContext } from "../context/envelope";
import { SSEParser, type ParsedSSEEvent } from "./parser";

export interface StreamCitation {
  id: string;
  type: "agent" | "run";
  label: string;
  href: string;
}

export interface StreamToolResult {
  toolCallId: string;
  toolName: string;
  mutates: boolean;
  status: "pending" | "rejected" | "succeeded" | "failed";
  preview: { kind: "graph" | "diff" | "table" | "text"; summary: string; data: unknown };
  commitResult?: { summary: string; href?: string; undo: { kind: string; payload: unknown } };
  error?: string;
}

export type CopilotStreamEvent =
  | { type: "token"; delta: string }
  | { type: "done"; messageId: string; content: string; citations: StreamCitation[]; userMessageId: string }
  | { type: "error"; kind: "rate_limit" | "provider_down" | "context_too_large" | "unknown"; message: string }
  | { type: "tool_start"; toolName: string; userMessageId: string }
  | { type: "tool_result"; result: StreamToolResult; userMessageId: string }
  | { type: "tool_denied"; toolName: string; message: string };

export interface SendCopilotMessageParams {
  workspaceSlug: string;
  threadId: string;
  envelope: CopilotContext;
  mode: "send" | "edit" | "regenerate" | "retry";
  content?: string;
  messageId?: string;
  /** Minted by the caller (features/copilot/messages/store.ts) and reused
   *  by its own `stop()` to POST /api/copilot/stream/cancel -- see
   *  features/copilot/lib/cancellation.ts for why aborting `signal` alone
   *  isn't enough to actually stop the server's real Groq call. */
  requestId: string;
  signal: AbortSignal;
}

/**
 * Drives POST /api/copilot/stream and yields typed events as they arrive. A
 * `fetch()` POST read manually, not `EventSource` -- same reasoning as B4's
 * run-route client: `EventSource` is GET-only and can't carry the request
 * body (thread id, mode, the context envelope) this endpoint needs.
 *
 * Cancellation (gate item 5) is the caller's `AbortController` aborting
 * `signal` -- identical to B4's Stop button, which aborts the same `fetch()`
 * driving the run.
 */
export async function* streamCopilotMessage(params: SendCopilotMessageParams): AsyncGenerator<CopilotStreamEvent> {
  const response = await fetch("/api/copilot/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceSlug: params.workspaceSlug,
      threadId: params.threadId,
      envelope: params.envelope,
      mode: params.mode,
      content: params.content,
      messageId: params.messageId,
      requestId: params.requestId,
    }),
    signal: params.signal,
  });

  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `The copilot request failed (${response.status}).`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = new SSEParser();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const event of parser.push(decoder.decode(value, { stream: true }))) {
        const parsedEvent = toStreamEvent(event);
        if (parsedEvent) yield parsedEvent;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function toStreamEvent(event: ParsedSSEEvent): CopilotStreamEvent | null {
  try {
    const data = JSON.parse(event.data) as Record<string, unknown>;
    if (event.event === "token" && typeof data.delta === "string") {
      return { type: "token", delta: data.delta };
    }
    if (
      event.event === "done" &&
      typeof data.messageId === "string" &&
      typeof data.content === "string" &&
      typeof data.userMessageId === "string"
    ) {
      return {
        type: "done",
        messageId: data.messageId,
        content: data.content,
        citations: Array.isArray(data.citations) ? (data.citations as StreamCitation[]) : [],
        userMessageId: data.userMessageId,
      };
    }
    if (event.event === "error" && typeof data.kind === "string" && typeof data.message === "string") {
      const kind = data.kind;
      if (kind === "rate_limit" || kind === "provider_down" || kind === "context_too_large" || kind === "unknown") {
        return { type: "error", kind, message: data.message };
      }
    }
    if (event.event === "tool_start" && typeof data.toolName === "string" && typeof data.userMessageId === "string") {
      return { type: "tool_start", toolName: data.toolName, userMessageId: data.userMessageId };
    }
    if (event.event === "tool_result" && typeof data.toolCallId === "string" && typeof data.userMessageId === "string") {
      const { userMessageId, ...result } = data as unknown as StreamToolResult & { userMessageId: string };
      return { type: "tool_result", result, userMessageId };
    }
    if (event.event === "tool_denied" && typeof data.toolName === "string" && typeof data.message === "string") {
      return { type: "tool_denied", toolName: data.toolName, message: data.message };
    }
  } catch {
    // Malformed frame -- dropped rather than crashing the stream over one bad event.
  }
  return null;
}
