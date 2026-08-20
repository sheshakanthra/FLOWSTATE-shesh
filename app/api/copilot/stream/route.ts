import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { getSessionFromRequest } from "@/lib/auth/session";
import { DEFAULT_GROQ_MODEL } from "@/lib/llm/models";
import {
  LLMContextTooLargeError,
  LLMProviderUnavailableError,
  LLMRateLimitError,
  getProvider,
} from "@/lib/llm/provider";
import {
  appendMessage,
  deleteMessagesFrom,
  getMessage,
  getThread,
  listMessages,
  type CitationRecord,
} from "@/lib/repos/copilot";
import { copilotContextSchema } from "@/features/copilot/context/envelope";
import { CANCELLATION_POLL_INTERVAL_MS, clearRequestCancellation, wasRequestCancelled } from "@/features/copilot/lib/cancellation";
import { resolveCitations } from "@/features/copilot/lib/citations";
import { buildCopilotPrompt } from "@/features/copilot/lib/prompt";
import { retrieveContext } from "@/features/copilot/lib/retrieve";
import { proposeToolCall } from "@/features/copilot/actions/execute";
import { toLLMToolSpecs } from "@/features/copilot/tools/registry";
import type { ToolActionResult } from "@/features/copilot/actions/execute";

const requestSchema = z
  .object({
    workspaceSlug: z.string().min(1),
    threadId: z.string().min(1),
    envelope: copilotContextSchema,
    mode: z.enum(["send", "edit", "regenerate", "retry"]),
    content: z.string().trim().min(1).max(8000).optional(),
    messageId: z.string().optional(),
    // Gate item 5's cancellation mechanism -- see
    // features/copilot/lib/cancellation.ts for why this exists instead of
    // relying on `request.signal`.
    requestId: z.string().min(1),
  })
  .refine((data) => data.mode === "regenerate" || data.mode === "retry" || Boolean(data.content), {
    message: "content is required for send/edit",
    path: ["content"],
  })
  .refine((data) => data.mode === "send" || data.mode === "retry" || Boolean(data.messageId), {
    message: "messageId is required for edit/regenerate",
    path: ["messageId"],
  });

/** What the client's SSE parser (features/copilot/stream/parser.ts) reads.
 *  `event:`/`data:` framing, not the NDJSON B4 used for the run route --
 *  this session's spec names SSE by name, and the wire format is what "SSE"
 *  actually refers to; the client still can't use a native `EventSource`
 *  (GET-only, no body) for the same reason B4's run route couldn't, so it's
 *  a `fetch()` POST read manually, same as B4, just framed as SSE instead of
 *  NDJSON. */
type StreamEvent =
  | { event: "token"; data: { delta: string } }
  | {
      event: "done";
      // `userMessageId` -- session spec item 9's persistence has to reach
      // the user's own bubble too, not just the assistant's: the client
      // adds an optimistic "pending-user-…" message before this request
      // even lands (features/copilot/messages/store.ts's runStream), and
      // without the real id coming back here, that message's id never
      // stops looking "pending" -- which silently hides its own action row
      // (Edit and resend, gate item 6) forever, not just after a reload.
      data: { messageId: string; content: string; citations: CitationRecord[]; userMessageId: string };
    }
  | {
      event: "error";
      data: { kind: "rate_limit" | "provider_down" | "context_too_large" | "unknown"; message: string };
    }
  // C3: the model chose to call a tool instead of replying with text. Sent
  // the instant the tool call is recognized (before `run()` executes), so
  // the client can register it with the FiringBar right away (gate item 6)
  // rather than waiting for the tool to finish before showing anything is
  // happening at all.
  | { event: "tool_start"; data: { toolName: string; userMessageId: string } }
  // The tool ran (or, for a mutating tool, was proposed) and resolved to a
  // real, persisted tool_calls row -- `status` tells the client whether
  // this needs approval ("pending"), is a finished read-only answer
  // ("succeeded"), or failed outright ("failed", gate item 7).
  | { event: "tool_result"; data: ToolActionResult & { userMessageId: string } }
  // The tool call never became a row at all -- permission denied, an
  // unknown tool name, or arguments that failed validation. Nothing to
  // retry (the caller's role isn't going to change mid-conversation), so
  // this is its own event rather than a fabricated "failed" tool_result.
  | { event: "tool_denied"; data: { toolName: string; message: string } };

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { workspaceSlug, threadId, envelope, mode, requestId } = parsed.data;

  const context = await requireRole(request, workspaceSlug, "member");
  if (context instanceof Response) return context;
  const workspaceId = context.workspace.id;

  const userId = getSessionFromRequest(request)?.userId;
  if (!userId) return Response.json({ error: "Sign in to continue." }, { status: 401 });

  const thread = await getThread(workspaceId, userId, threadId);
  if (!thread) return Response.json({ error: "Conversation not found." }, { status: 404 });

  if (mode === "send") {
    await appendMessage(workspaceId, threadId, { role: "user", content: parsed.data.content! });
  } else if (mode === "edit") {
    const target = await getMessage(workspaceId, threadId, parsed.data.messageId!);
    if (!target || target.role !== "user") {
      return Response.json({ error: "That message can't be edited." }, { status: 400 });
    }
    await deleteMessagesFrom(workspaceId, threadId, target.id);
    await appendMessage(workspaceId, threadId, { role: "user", content: parsed.data.content! });
  } else if (mode === "regenerate") {
    const target = await getMessage(workspaceId, threadId, parsed.data.messageId!);
    if (!target || target.role !== "assistant") {
      return Response.json({ error: "That message can't be regenerated." }, { status: 400 });
    }
    await deleteMessagesFrom(workspaceId, threadId, target.id);
  }
  // mode === "retry": no state change -- the failed attempt never persisted
  // anything (a rejected/aborted stream appends nothing on the error path,
  // see below), so retrying is just re-running the same turn against
  // whatever the last user message already in the thread is.

  const history = await listMessages(workspaceId, threadId);
  const lastUserMessage = [...history].reverse().find((message) => message.role === "user");
  if (!lastUserMessage) {
    return Response.json({ error: "Nothing to respond to yet." }, { status: 400 });
  }

  const retrieved = await retrieveContext({
    workspaceId,
    workspaceSlug,
    message: lastUserMessage.content,
    envelope,
  });

  const prompt = buildCopilotPrompt({
    workspaceName: context.workspace.name,
    envelope,
    retrieved,
    history: history.map((message) => ({ role: message.role, content: message.content })),
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(payload: StreamEvent) {
        // A client-initiated Stop (gate item 5) tears the response down from
        // the reading side before the loop below has necessarily noticed --
        // same reasoning as B4's run route: the DB write is what has to
        // succeed, a failed enqueue on an already-closed stream is expected.
        try {
          controller.enqueue(encoder.encode(`event: ${payload.event}\ndata: ${JSON.stringify(payload.data)}\n\n`));
        } catch {
          // ignore
        }
      }

      // See features/copilot/lib/cancellation.ts: this is a purely local
      // AbortController this route both creates and aborts itself --
      // `/api/copilot/stream/cancel` never touches it directly, it only
      // writes to Postgres, which the polling below reads.
      const cancelController = new AbortController();
      let lastCancellationCheck = 0;

      let accumulated = "";
      // C3: at most one tool call per turn (spec: "no autonomous multi-step
      // chains") -- the first one recognized wins; anything Groq proposes
      // after it is drained from the stream but otherwise ignored.
      let pendingToolCall: { id: string; name: string; arguments: string } | null = null;
      try {
        for await (const chunk of getProvider().stream({
          model: DEFAULT_GROQ_MODEL,
          messages: prompt,
          signal: cancelController.signal,
          tools: toLLMToolSpecs(),
        })) {
          if (chunk.type === "token") {
            accumulated += chunk.delta;
            send({ event: "token", data: { delta: chunk.delta } });
          } else if (chunk.type === "tool_call" && !pendingToolCall) {
            pendingToolCall = chunk.toolCall;
            send({ event: "tool_start", data: { toolName: chunk.toolCall.name, userMessageId: lastUserMessage.id } });
          }

          const now = Date.now();
          if (now - lastCancellationCheck >= CANCELLATION_POLL_INTERVAL_MS) {
            lastCancellationCheck = now;
            if (await wasRequestCancelled(workspaceId, threadId, requestId)) {
              cancelController.abort();
            }
          }
        }

        if (pendingToolCall) {
          let parsedArgs: unknown = {};
          try {
            parsedArgs = pendingToolCall.arguments ? JSON.parse(pendingToolCall.arguments) : {};
          } catch {
            // Malformed JSON from the model -- proposeToolCall's own Zod
            // validation will reject `{}` against a tool that requires real
            // fields, which is the honest outcome here (not a crash).
          }

          const outcome = await proposeToolCall({
            toolName: pendingToolCall.name,
            input: parsedArgs,
            messageId: lastUserMessage.id,
            ctx: { workspaceId, workspaceSlug, userId, role: context.role },
          });

          if (!outcome.ok) {
            send({ event: "tool_denied", data: { toolName: pendingToolCall.name, message: outcome.error } });
          } else {
            send({ event: "tool_result", data: { ...outcome.result, userMessageId: lastUserMessage.id } });
          }
        } else {
          const { content, citations } = resolveCitations(accumulated, retrieved);
          const saved = await appendMessage(workspaceId, threadId, { role: "assistant", content, citations });
          send({
            event: "done",
            data: { messageId: saved.id, content: saved.content, citations: saved.citations ?? [], userMessageId: lastUserMessage.id },
          });
        }
      } catch (error) {
        const isAbort = Boolean(error && typeof error === "object" && "name" in error && error.name === "AbortError");
        if (isAbort) {
          // Stop generation (gate item 5): persist exactly what was produced
          // before the client cut the connection, citations resolved from
          // that partial text the same way a completed answer's would be.
          const { content, citations } = resolveCitations(accumulated, retrieved);
          if (content.trim().length > 0) {
            await appendMessage(workspaceId, threadId, { role: "assistant", content, citations });
          }
        } else if (error instanceof LLMRateLimitError) {
          send({ event: "error", data: { kind: "rate_limit", message: error.message } });
        } else if (error instanceof LLMContextTooLargeError) {
          send({ event: "error", data: { kind: "context_too_large", message: error.message } });
        } else if (error instanceof LLMProviderUnavailableError) {
          send({ event: "error", data: { kind: "provider_down", message: error.message } });
        } else {
          const message = error instanceof Error ? error.message : "The copilot failed to respond.";
          send({ event: "error", data: { kind: "unknown", message } });
        }
      } finally {
        await clearRequestCancellation(workspaceId, threadId, requestId);
        try {
          controller.close();
        } catch {
          // Already closed by the reading side disconnecting -- fine.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
