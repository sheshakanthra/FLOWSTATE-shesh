import type { ZodType } from "zod";
import type { Role } from "@/lib/auth/permissions";

/** Everything a tool's `run`/`commit` needs about who's asking and where --
 *  resolved once per request by the caller (the stream route, or the direct
 *  `/api/copilot/execute` route for gate item 4's own testability) and
 *  threaded through, never re-derived inside a tool definition. */
export interface ToolContext {
  workspaceId: string;
  workspaceSlug: string;
  userId: string;
  role: Role;
}

export type ToolPreviewKind = "graph" | "diff" | "table" | "text";

/** What the approval card / result card actually renders -- `kind` selects
 *  the component (features/copilot/tools/previews/*), `summary` is the
 *  one-line, human-readable statement of consequence gate item 9 requires
 *  ("Approve creating agent X with 5 nodes", not just "Approve"), and `data`
 *  is whatever shape that preview kind needs. */
export interface ToolPreview<TData = unknown> {
  kind: ToolPreviewKind;
  summary: string;
  data: TData;
}

/** Read-only tools return this and nothing else -- `preview` *is* the final
 *  answer, rendered immediately, no approval step. Mutating tools return the
 *  same shape plus `commitPayload`: everything `commit` needs to actually
 *  persist the change once a person approves it. Nothing is written to the
 *  database by `run()` for a mutating tool -- that is the whole point of the
 *  approval rule (spec item 3). */
export interface ToolRunResult<TPreviewData = unknown, TCommitPayload = unknown> {
  preview: ToolPreview<TPreviewData>;
  commitPayload?: TCommitPayload;
}

/** What the client needs to reverse a committed action via `useUndoable`
 *  (lib/undo). `kind` selects the reversal in
 *  features/copilot/actions/undo-dispatch.ts; `payload` is whatever that
 *  reversal needs to run and run again (redo). */
export interface ToolUndoDescriptor {
  kind: string;
  payload: unknown;
}

export interface ToolCommitResult {
  /** Confirmation-toast text, e.g. "Created Inbound Lead Qualifier". */
  summary: string;
  undo: ToolUndoDescriptor;
  /** Where to see the effect, if anywhere -- e.g. a new agent's build URL. */
  href?: string;
}

export interface ToolDefinition<TInput = unknown, TPreviewData = unknown, TCommitPayload = unknown> {
  name: string;
  /** Shown to the LLM verbatim -- what the tool does and when to use it. */
  description: string;
  inputSchema: ZodType<TInput>;
  /** JSON-schema mirror of `inputSchema`, hand-written (no
   *  `zod-to-json-schema` -- not an approved dependency): the shape Groq's
   *  function-calling API needs to know what arguments to produce. Kept next
   *  to `inputSchema` in each tool's own definition file so the two shapes
   *  can be eyeballed together rather than drifting apart in separate files. */
  parameters: Record<string, unknown>;
  requiredRole: Role;
  mutates: boolean;
  run(input: TInput, ctx: ToolContext): Promise<ToolRunResult<TPreviewData, TCommitPayload>>;
  /** Present only when `mutates` is true -- persists a previously computed
   *  `commitPayload` after approval. Absent on every read-only tool. */
  commit?(commitPayload: TCommitPayload, input: TInput, ctx: ToolContext): Promise<ToolCommitResult>;
}

/** The shape every tool is stored as once registered -- `TInput`/etc. differ
 *  per tool, so (matching `features/agents/nodes/registry.ts`'s own
 *  precedent for the same problem) the registry itself is untyped-at-rest;
 *  each definition file is the one place that knows its own real types. */
export type AnyToolDefinition = ToolDefinition<unknown, unknown, unknown>;
