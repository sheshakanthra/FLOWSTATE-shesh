import { eq, inArray } from "drizzle-orm";
import { toolCalls, type toolCallStatusEnum } from "@/db/schema";
import { withScope } from "./db";

export type ToolCallStatus = (typeof toolCallStatusEnum.enumValues)[number];

/** `input`/`output` are stored, read, and returned as opaque JSON here --
 *  same "unknown at rest" precedent as `lib/repos/agents.ts`'s
 *  `AgentGraphPayload`. `features/copilot/actions/execute.ts` is the one
 *  place that knows what shape a tool's own `output` actually holds
 *  (`{ preview, commitPayload?, commitResult?, error? }`) and validates it
 *  on the way in and out -- this file has no opinion on tool internals. */
export interface ToolCallRecord {
  id: string;
  messageId: string;
  toolName: string;
  input: unknown;
  output: unknown;
  status: ToolCallStatus;
  createdAt: Date;
}

function toRecord(row: typeof toolCalls.$inferSelect): ToolCallRecord {
  return {
    id: row.id,
    messageId: row.messageId,
    toolName: row.toolName,
    input: row.input,
    output: row.output,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export interface CreateToolCallInput {
  messageId: string;
  toolName: string;
  input: unknown;
  output: unknown;
  status: ToolCallStatus;
}

export async function createToolCall(workspaceId: string, input: CreateToolCallInput): Promise<ToolCallRecord> {
  const [row] = await withScope({ workspaceId }, (tx) =>
    tx
      .insert(toolCalls)
      .values({
        workspaceId,
        messageId: input.messageId,
        toolName: input.toolName,
        input: input.input as object,
        output: input.output as object,
        status: input.status,
      })
      .returning(),
  );
  if (!row) throw new Error("tool call insert failed");
  return toRecord(row);
}

export async function getToolCall(workspaceId: string, id: string): Promise<ToolCallRecord | null> {
  const [row] = await withScope({ workspaceId }, (tx) => tx.select().from(toolCalls).where(eq(toolCalls.id, id)).limit(1));
  return row ? toRecord(row) : null;
}

export interface UpdateToolCallInput {
  status?: ToolCallStatus;
  output?: unknown;
}

export async function updateToolCall(workspaceId: string, id: string, patch: UpdateToolCallInput): Promise<ToolCallRecord | null> {
  const values: Partial<typeof toolCalls.$inferInsert> = {};
  if (patch.status !== undefined) values.status = patch.status;
  if (patch.output !== undefined) values.output = patch.output as object;

  const [row] = await withScope({ workspaceId }, (tx) =>
    tx.update(toolCalls).set(values).where(eq(toolCalls.id, id)).returning(),
  );
  return row ? toRecord(row) : null;
}

/** Thread reload hydration (features/copilot/messages/store.ts's `load`):
 *  one query for every tool call attached to any message in the thread,
 *  rather than N+1 per message. */
export async function listToolCallsForMessages(workspaceId: string, messageIds: string[]): Promise<ToolCallRecord[]> {
  if (messageIds.length === 0) return [];
  const rows = await withScope({ workspaceId }, (tx) =>
    tx.select().from(toolCalls).where(inArray(toolCalls.messageId, messageIds)),
  );
  return rows.map(toRecord);
}
