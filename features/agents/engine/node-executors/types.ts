import type { ScopeGraphNode } from "../../lib/scope";
import type { EngineGraphEdge, NodeOutputs } from "../scope-resolver";

/**
 * Session spec's own note: "Node executors should be pure functions of
 * (config, resolvedInput, ctx). Keep side effects in the orchestrator so
 * executors stay unit-testable without a database." `ctx` still carries
 * real side-effecting capabilities (the Groq call, a shared in-run memory
 * map) -- "pure" here means "no DB writes, no run_steps bookkeeping, no
 * knowledge of retry/step-recording," not "no I/O at all." The orchestrator
 * (`executor.ts`) is the only thing that touches `lib/repos/runs.ts`.
 */
export interface ExecutionContext {
  signal: AbortSignal;
  /** Set once per run from the test console's input form -- the only thing
   *  a trigger node's executor reads, since a trigger has no incoming edges
   *  of its own to resolve an input from. */
  runInput: unknown;
  /** Streams an LLM node's tokens out to the orchestrator's own step
   *  callback as they arrive -- called zero or more times per execution,
   *  only by llm.ts. */
  onToken: (delta: string) => void;
  /** In-run key/value store backing the Memory node -- scoped to a single
   *  run, not persisted beyond it (see PROGRESS.md's B4 decisions for why:
   *  no durable memory store exists elsewhere in this codebase to persist
   *  into). */
  memory: Map<string, unknown>;
}

/**
 * A node's execution result. `output` is keyed by *output port id*, and --
 * this is the mechanism the orchestrator uses to prune branches -- a port
 * simply absent from `output` is treated as "did not fire": Condition
 * returns only `{true: ...}` or `{false: ...}`, never both, and anything
 * wired only to the port that didn't fire gets marked `skipped` rather than
 * executed.
 */
export interface NodeExecutionResult {
  output: Record<string, unknown>;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  costCents?: number;
}

export type NodeExecutor<TConfig extends Record<string, unknown> = Record<string, unknown>> = (params: {
  config: TConfig;
  /** Values resolved from this node's *wired* input ports (an edge from
   *  another node's output) -- keyed by input port id. Free-text config
   *  fields (a prompt, an expression) are interpolated separately, before
   *  this function is even called -- see scope-resolver.ts's
   *  `interpolateConfig`, applied by the orchestrator to `config` itself. */
  resolvedInput: Record<string, unknown>;
  ctx: ExecutionContext;
}) => Promise<NodeExecutionResult>;

export type { EngineGraphEdge, NodeOutputs, ScopeGraphNode };
