import { z } from "zod";
import { logActivityEvent } from "@/lib/repos/activity";
import type { ToolCommitResult, ToolDefinition } from "../types";

const inputSchema = z.object({
  clientName: z.string().min(1).max(200),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
});
type Input = z.infer<typeof inputSchema>;

interface PreviewData {
  text: string;
  meta: Record<string, string>;
}

type CommitPayload = Input;

/**
 * "Client-facing update, previews as formatted text" (spec item 2).
 * Owner-only (`requiredRole`) -- gate item 4's own test target: sending
 * something client-facing is the one action in this slice's six tools
 * deliberately gated above "member", mirroring A6's workspace-rename
 * precedent for what an Owner-only action looks like.
 *
 * There is no client-messaging channel in this vertical slice (CRM/client
 * portal are explicitly out of scope, per CLAUDE.md) -- approving this
 * doesn't pretend to email or Slack anyone. It logs a real, honest
 * `activity_events` row (the same "client.updated" shape `db/seed.ts`
 * already seeds), which is a genuine, workspace-visible mutation other
 * tools (`summarize_activity`) and a future Today dashboard can read back,
 * not a no-op dressed up as one.
 */
export const draftMessageTool: ToolDefinition<Input, PreviewData, CommitPayload> = {
  name: "draft_message",
  description:
    "Drafts a client-facing status update for a named client -- a subject and a message body. Use this when the user asks to draft, write, or send an update to a client. Requires the workspace owner's approval to send.",
  inputSchema,
  parameters: {
    type: "object",
    properties: {
      clientName: { type: "string", description: "Which client this update is for." },
      subject: { type: "string", description: "A short subject line." },
      body: { type: "string", description: "The message body, written for the client to read directly." },
    },
    required: ["clientName", "subject", "body"],
  },
  requiredRole: "owner",
  mutates: true,
  async run(input) {
    return {
      preview: {
        kind: "text",
        summary: `Send "${input.subject}" to ${input.clientName}`,
        data: { text: input.body, meta: { To: input.clientName, Subject: input.subject } },
      },
      commitPayload: input,
    };
  },
  async commit(payload, _input, ctx): Promise<ToolCommitResult> {
    const event = await logActivityEvent(ctx.workspaceId, {
      actorId: ctx.userId,
      verb: "client.message_sent",
      subjectType: "client",
      summary: `Sent "${payload.subject}" to ${payload.clientName}`,
      metadata: { clientName: payload.clientName, subject: payload.subject, body: payload.body },
    });
    return {
      summary: `Sent "${payload.subject}" to ${payload.clientName}`,
      undo: {
        kind: "delete_activity_event",
        payload: { id: event.id, workspaceSlug: ctx.workspaceSlug, clientName: payload.clientName, subject: payload.subject, body: payload.body },
      },
    };
  },
};
