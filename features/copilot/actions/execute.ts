import { roleAtLeast } from "@/lib/auth/permissions";
import { createToolCall, getToolCall, updateToolCall, type ToolCallStatus } from "@/lib/repos/tool-calls";
import { getTool } from "../tools/registry";
import type { ToolCommitResult, ToolContext, ToolPreview } from "../tools/types";

/** What `tool_calls.output` actually holds at rest -- see
 *  `lib/repos/tool-calls.ts`'s own doc comment for why the repo layer keeps
 *  this opaque. This is the one place that knows the real shape. */
interface StoredOutput {
  preview: ToolPreview;
  commitPayload?: unknown;
  commitResult?: ToolCommitResult;
  error?: string;
  /** Which phase the last attempt failed in -- decides what `retryToolCall`
   *  re-runs: the whole proposal (`"run"`) or just the persist step
   *  (`"commit"`), since a failed commit means the proposal itself was fine
   *  and shouldn't be recomputed (a fresh LLM call could even propose
   *  something different the second time). */
  failedAt?: "run" | "commit";
}

/** Never `"approved"` -- that status only ever exists transiently inside
 *  `approveToolCall`/`retryToolCall`'s own DB write, between marking a call
 *  approved and the commit actually finishing; the result returned to a
 *  caller always reflects the outcome (`"succeeded"`/`"failed"`), never the
 *  in-between state. */
export interface ToolActionResult {
  toolCallId: string;
  toolName: string;
  mutates: boolean;
  status: Exclude<ToolCallStatus, "approved">;
  preview: ToolPreview;
  commitResult?: ToolCommitResult;
  error?: string;
}

export type ToolActionOutcome = { ok: true; result: ToolActionResult } | { ok: false; status: number; error: string };

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export interface ProposeToolCallParams {
  toolName: string;
  input: unknown;
  messageId: string;
  ctx: ToolContext;
}

/**
 * Runs a tool: immediately, for a read-only one (its result *is* the
 * answer); computed-but-not-persisted, for a mutating one (nothing is
 * written to any table besides this `tool_calls` row itself until
 * `approveToolCall` runs -- the approval rule, spec item 3). Called both by
 * the streaming route (when the model decides to call a tool mid-turn) and
 * directly by `POST /api/copilot/execute` -- the latter is what gate item
 * 4's permission test hits, bypassing the LLM entirely.
 */
export async function proposeToolCall(params: ProposeToolCallParams): Promise<ToolActionOutcome> {
  const tool = getTool(params.toolName);
  if (!tool) return { ok: false, status: 404, error: `Unknown tool "${params.toolName}".` };
  if (!roleAtLeast(params.ctx.role, tool.requiredRole)) {
    return { ok: false, status: 403, error: `This action requires the ${tool.requiredRole} role.` };
  }
  const parsedInput = tool.inputSchema.safeParse(params.input);
  if (!parsedInput.success) {
    return { ok: false, status: 400, error: "Invalid tool input." };
  }

  try {
    const runResult = await tool.run(parsedInput.data, params.ctx);
    const status: ToolCallStatus = tool.mutates ? "pending" : "succeeded";
    const output: StoredOutput = { preview: runResult.preview, commitPayload: runResult.commitPayload };
    const row = await createToolCall(params.ctx.workspaceId, {
      messageId: params.messageId,
      toolName: tool.name,
      input: parsedInput.data,
      output,
      status,
    });
    return { ok: true, result: { toolCallId: row.id, toolName: tool.name, mutates: tool.mutates, status, preview: runResult.preview } };
  } catch (error) {
    const message = errorMessage(error, "This tool failed to run.");
    const output: StoredOutput = { preview: { kind: "text", summary: `${tool.name} failed`, data: { text: message } }, error: message, failedAt: "run" };
    const row = await createToolCall(params.ctx.workspaceId, {
      messageId: params.messageId,
      toolName: tool.name,
      input: parsedInput.data,
      output,
      status: "failed",
    });
    // Still `ok: true`: the *proposal* mechanism worked (a real, retryable
    // row exists) even though the tool itself failed -- that failure is the
    // result, not a request-handling error.
    return { ok: true, result: { toolCallId: row.id, toolName: tool.name, mutates: tool.mutates, status: "failed", preview: output.preview, error: message } };
  }
}

export interface ResolveToolCallParams {
  toolCallId: string;
  ctx: ToolContext;
}

/** Approves a pending mutating tool call: persists whatever `run()` already
 *  computed as `commitPayload`. Re-checks the tool's own required role
 *  independently of whatever check happened at proposal time -- the two are
 *  seconds apart in the UI but this is a genuinely separate request, and
 *  CLAUDE.md's "hides AND rejects" rule means every mutating step re-proves
 *  authorization, not just the first one. */
export async function approveToolCall(params: ResolveToolCallParams): Promise<ToolActionOutcome> {
  const row = await getToolCall(params.ctx.workspaceId, params.toolCallId);
  if (!row) return { ok: false, status: 404, error: "Tool call not found." };
  const tool = getTool(row.toolName);
  if (!tool || !tool.commit) return { ok: false, status: 400, error: "This action can't be approved." };
  if (!roleAtLeast(params.ctx.role, tool.requiredRole)) {
    return { ok: false, status: 403, error: `This action requires the ${tool.requiredRole} role.` };
  }
  if (row.status !== "pending") {
    return { ok: false, status: 409, error: "This action has already been resolved." };
  }

  const stored = row.output as StoredOutput;
  await updateToolCall(params.ctx.workspaceId, row.id, { status: "approved" });

  try {
    const commitResult = await tool.commit(stored.commitPayload, row.input, params.ctx);
    const nextOutput: StoredOutput = { preview: stored.preview, commitPayload: stored.commitPayload, commitResult };
    await updateToolCall(params.ctx.workspaceId, row.id, { status: "succeeded", output: nextOutput });
    return { ok: true, result: { toolCallId: row.id, toolName: row.toolName, mutates: true, status: "succeeded", preview: stored.preview, commitResult } };
  } catch (error) {
    const message = errorMessage(error, "This action failed to complete.");
    const nextOutput: StoredOutput = { preview: stored.preview, commitPayload: stored.commitPayload, error: message, failedAt: "commit" };
    await updateToolCall(params.ctx.workspaceId, row.id, { status: "failed", output: nextOutput });
    return { ok: true, result: { toolCallId: row.id, toolName: row.toolName, mutates: true, status: "failed", preview: stored.preview, error: message } };
  }
}

export async function rejectToolCall(params: ResolveToolCallParams): Promise<ToolActionOutcome> {
  const row = await getToolCall(params.ctx.workspaceId, params.toolCallId);
  if (!row) return { ok: false, status: 404, error: "Tool call not found." };
  const tool = getTool(row.toolName);
  if (!tool) return { ok: false, status: 404, error: "Unknown tool." };
  if (row.status !== "pending") {
    return { ok: false, status: 409, error: "This action has already been resolved." };
  }

  await updateToolCall(params.ctx.workspaceId, row.id, { status: "rejected" });
  const stored = row.output as StoredOutput;
  return { ok: true, result: { toolCallId: row.id, toolName: row.toolName, mutates: true, status: "rejected", preview: stored.preview } };
}

/** Gate item 7: "a failing tool shows a specific error and a working
 *  retry." A failed *proposal* (read-only tool, or a mutating tool's `run`)
 *  re-runs `run()` from scratch against the same stored input. A failed
 *  *commit* (approved, then `commit()` itself threw -- e.g. the agent it
 *  was about to update was deleted in between) re-attempts only `commit()`
 *  against the same stored `commitPayload`, never re-proposing (the
 *  proposal already succeeded; re-running it could silently produce a
 *  different plan than the one that was actually approved). */
export async function retryToolCall(params: ResolveToolCallParams): Promise<ToolActionOutcome> {
  const row = await getToolCall(params.ctx.workspaceId, params.toolCallId);
  if (!row) return { ok: false, status: 404, error: "Tool call not found." };
  const tool = getTool(row.toolName);
  if (!tool) return { ok: false, status: 404, error: "Unknown tool." };
  if (!roleAtLeast(params.ctx.role, tool.requiredRole)) {
    return { ok: false, status: 403, error: `This action requires the ${tool.requiredRole} role.` };
  }
  if (row.status !== "failed") {
    return { ok: false, status: 409, error: "Only a failed action can be retried." };
  }

  const stored = row.output as StoredOutput;

  if (stored.failedAt === "commit" && tool.commit) {
    try {
      const commitResult = await tool.commit(stored.commitPayload, row.input, params.ctx);
      const nextOutput: StoredOutput = { preview: stored.preview, commitPayload: stored.commitPayload, commitResult };
      await updateToolCall(params.ctx.workspaceId, row.id, { status: "succeeded", output: nextOutput });
      return { ok: true, result: { toolCallId: row.id, toolName: row.toolName, mutates: true, status: "succeeded", preview: stored.preview, commitResult } };
    } catch (error) {
      const message = errorMessage(error, "This action failed to complete.");
      const nextOutput: StoredOutput = { preview: stored.preview, commitPayload: stored.commitPayload, error: message, failedAt: "commit" };
      await updateToolCall(params.ctx.workspaceId, row.id, { status: "failed", output: nextOutput });
      return { ok: true, result: { toolCallId: row.id, toolName: row.toolName, mutates: true, status: "failed", preview: stored.preview, error: message } };
    }
  }

  try {
    const runResult = await tool.run(row.input, params.ctx);
    const status: ToolCallStatus = tool.mutates ? "pending" : "succeeded";
    const nextOutput: StoredOutput = { preview: runResult.preview, commitPayload: runResult.commitPayload };
    await updateToolCall(params.ctx.workspaceId, row.id, { status, output: nextOutput });
    return { ok: true, result: { toolCallId: row.id, toolName: tool.name, mutates: tool.mutates, status, preview: runResult.preview } };
  } catch (error) {
    const message = errorMessage(error, "This tool failed to run.");
    const nextOutput: StoredOutput = { preview: { kind: "text", summary: `${tool.name} failed`, data: { text: message } }, error: message, failedAt: "run" };
    await updateToolCall(params.ctx.workspaceId, row.id, { status: "failed", output: nextOutput });
    return { ok: true, result: { toolCallId: row.id, toolName: tool.name, mutates: tool.mutates, status: "failed", preview: nextOutput.preview, error: message } };
  }
}
