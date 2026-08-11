import { getNodeType } from "../nodes/registry";
import { interpolateConfig, resolvePortInputs, type EngineGraphEdge, type NodeOutputs } from "./scope-resolver";
import { DEFAULT_RETRY_POLICY, LLM_CALL_RETRY_POLICY, isAbortError, withRetry } from "./retry";
import type { ExecutionContext, NodeExecutor } from "./node-executors/types";
import { triggerExecutor } from "./node-executors/trigger";
import { llmExecutor } from "./node-executors/llm";
import { toolExecutor } from "./node-executors/tool";
import { conditionExecutor } from "./node-executors/condition";
import { loopExecutor } from "./node-executors/loop";
import { memoryExecutor } from "./node-executors/memory";
import { knowledgeExecutor } from "./node-executors/knowledge";
import { transformExecutor } from "./node-executors/transform";
import { outputExecutor } from "./node-executors/output";
import { humanInLoopExecutor } from "./node-executors/human-in-loop";

/** Mirrors db/schema.ts's `run_step_kind` enum values exactly, but as an
 *  independently-declared literal union rather than an import from
 *  `lib/repos/runs.ts` -- the engine stays importable and unit-testable
 *  with zero dependency chain into DB-touching code (the spec's own note:
 *  "keep side effects in the orchestrator so executors stay unit-testable
 *  without a database" extends to the orchestrator's own module graph).
 *  TypeScript's structural typing accepts this union anywhere
 *  `lib/repos/runs.ts`'s `RunStepKind` is expected, and vice versa, as long
 *  as both lists of literals stay in sync. */
export type StepKind =
  | "trigger"
  | "llm_call"
  | "tool_call"
  | "condition"
  | "loop"
  | "memory"
  | "knowledge"
  | "transform"
  | "output"
  | "human_in_loop";

const KIND_BY_NODE_TYPE: Record<string, StepKind> = {
  trigger: "trigger",
  llm: "llm_call",
  tool: "tool_call",
  condition: "condition",
  loop: "loop",
  memory: "memory",
  knowledge: "knowledge",
  transform: "transform",
  output: "output",
  humanInLoop: "human_in_loop",
};

// A node's `type` string is the only link between a graph node and its
// executor, so executors of different config shapes necessarily share one
// untyped-at-rest map -- the same reasoning (and the same cast) as
// registry.ts's `registerNodeType`. Sound here for the identical reason: a
// node's config only ever reaches the executor registered under its own
// `type`, whose `configSchema` (registry.ts) is exactly what produced it.
const EXECUTORS: Record<string, NodeExecutor> = {
  trigger: triggerExecutor as unknown as NodeExecutor,
  llm: llmExecutor as unknown as NodeExecutor,
  tool: toolExecutor as unknown as NodeExecutor,
  condition: conditionExecutor as unknown as NodeExecutor,
  loop: loopExecutor as unknown as NodeExecutor,
  memory: memoryExecutor as unknown as NodeExecutor,
  knowledge: knowledgeExecutor as unknown as NodeExecutor,
  transform: transformExecutor as unknown as NodeExecutor,
  output: outputExecutor as unknown as NodeExecutor,
  humanInLoop: humanInLoopExecutor as unknown as NodeExecutor,
};

export interface EngineNode {
  id: string;
  type?: string;
  data: { label: string; config: Record<string, unknown>; disabled?: boolean };
}

export type StepStatus = "succeeded" | "failed" | "skipped";

export interface StepStartEvent {
  nodeId: string;
  stepIndex: number;
  name: string;
  kind: StepKind;
  input: unknown;
}

export interface StepEndEvent {
  nodeId: string;
  stepIndex: number;
  name: string;
  kind: StepKind;
  status: StepStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
  durationMs: number | null;
  input: unknown;
  output: unknown;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  costCents?: number;
  attempt: number;
  errorMessage?: string;
}

export interface RunGraphOptions {
  nodes: EngineNode[];
  edges: EngineGraphEdge[];
  runInput: unknown;
  signal: AbortSignal;
  onStepStart?: (event: StepStartEvent) => void;
  onToken?: (nodeId: string, delta: string) => void;
  onStepEnd?: (event: StepEndEvent) => void | Promise<void>;
}

export interface RunGraphResult {
  status: "succeeded" | "failed" | "cancelled";
  finalOutputs: unknown[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostCents: number;
  errorMessage?: string;
}

/** A stable dependency-respecting order (Kahn's algorithm over every edge,
 *  ignoring conditional firing) -- computed once so every node's
 *  predecessors have already been attempted, and their fired/skip state
 *  finalized, by the time this walk reaches it. Nodes unreachable from any
 *  0-indegree node (a genuine cycle, which the canvas already prevents on
 *  connect -- see lib/validation.ts) are appended at the end rather than
 *  dropped, so a malformed graph still produces a step row for every node
 *  instead of silently omitting some. */
function topologicalOrder(nodes: EngineNode[], edges: EngineGraphEdge[]): EngineNode[] {
  const indegree = new Map<string, number>(nodes.map((node) => [node.id, 0]));
  const incoming = new Map<string, EngineGraphEdge[]>(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    if (!indegree.has(edge.target) || !indegree.has(edge.source)) continue;
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    incoming.get(edge.target)?.push(edge);
  }

  const queue = nodes.filter((node) => indegree.get(node.id) === 0);
  const order: EngineNode[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) break;
    if (visited.has(node.id)) continue;
    visited.add(node.id);
    order.push(node);
    for (const edge of edges) {
      if (edge.source !== node.id) continue;
      const remaining = (indegree.get(edge.target) ?? 0) - 1;
      indegree.set(edge.target, remaining);
      if (remaining === 0) {
        const target = nodes.find((candidate) => candidate.id === edge.target);
        if (target) queue.push(target);
      }
    }
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) order.push(node);
  }
  return order;
}

/**
 * Whether every incoming edge into `node` is "dead" -- its source never
 * executed, failed, or executed but didn't fire the specific output port
 * that edge reads from (Condition/humanInLoop branch pruning, see
 * node-executors/types.ts's `NodeExecutionResult.output` doc comment). A
 * node with *no* incoming edges (a trigger, or an intentionally
 * disconnected node) is never skipped by this rule. A node with *several*
 * incoming edges is skipped only if *all* of them are dead -- one live
 * input is enough to run, the natural merge semantics for a convergence
 * point fed by more than one upstream branch.
 */
function shouldSkip(nodeId: string, edges: EngineGraphEdge[], outputs: NodeOutputs, failed: Set<string>, skipped: Set<string>): boolean {
  const incomingEdges = edges.filter((edge) => edge.target === nodeId);
  if (incomingEdges.length === 0) return false;
  return incomingEdges.every((edge) => {
    if (failed.has(edge.source) || skipped.has(edge.source)) return true;
    if (!edge.sourceHandle) return false;
    const sourceOutput = outputs.get(edge.source);
    return !sourceOutput || !(edge.sourceHandle in sourceOutput);
  });
}

/**
 * Topologically walks the graph, executing one node at a time (never in
 * parallel -- keeps step ordering, and therefore `stepIndex`, deterministic
 * and easy to reason about for a test-console-sized graph). Side effects
 * (DB writes) are deliberately not this function's job: `onStepStart`/
 * `onStepEnd` are the only way callers observe progress, so
 * `app/api/agents/[id]/run/route.ts` is what actually calls
 * `lib/repos/runs.ts` -- this function has no import of it at all.
 */
export async function runGraph(options: RunGraphOptions): Promise<RunGraphResult> {
  const { nodes, edges, runInput, signal, onStepStart, onToken, onStepEnd } = options;
  const order = topologicalOrder(nodes, edges);

  const outputs: NodeOutputs = new Map();
  const failed = new Set<string>();
  const skipped = new Set<string>();
  const finalOutputs: unknown[] = [];
  const memory = new Map<string, unknown>();

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostCents = 0;
  let stepIndex = 0;
  let cancelled = false;
  let runFailedMessage: string | undefined;

  for (const node of order) {
    if (signal.aborted) {
      cancelled = true;
      break;
    }

    const definition = node.type ? getNodeType(node.type) : undefined;
    const kind = node.type ? KIND_BY_NODE_TYPE[node.type] : undefined;
    const executor = node.type ? EXECUTORS[node.type] : undefined;
    if (!definition || !kind || !executor) {
      // An unregistered/unknown node type -- record nothing for it (it has
      // no valid kind to satisfy the DB's NOT NULL enum column) and treat
      // it as a dead branch for its dependents, same as a skip.
      skipped.add(node.id);
      continue;
    }

    if (node.data.disabled === true || shouldSkip(node.id, edges, outputs, failed, skipped)) {
      skipped.add(node.id);
      const resolvedInput = resolvePortInputs(node.id, edges, outputs);
      stepIndex += 1;
      await onStepEnd?.({
        nodeId: node.id,
        stepIndex,
        name: node.data.label,
        kind,
        status: "skipped",
        startedAt: null,
        finishedAt: null,
        durationMs: null,
        input: resolvedInput,
        output: null,
        attempt: 1,
      });
      continue;
    }

    const resolvedInput = resolvePortInputs(node.id, edges, outputs);
    const resolvedConfig = interpolateConfig(node.data.config, node.id, nodes, edges, outputs);

    stepIndex += 1;
    const currentStepIndex = stepIndex;
    onStepStart?.({ nodeId: node.id, stepIndex: currentStepIndex, name: node.data.label, kind, input: resolvedInput });

    const startedAt = new Date();
    const ctx: ExecutionContext = {
      signal,
      runInput,
      onToken: (delta) => onToken?.(node.id, delta),
      memory,
    };
    const retryPolicy = kind === "llm_call" ? LLM_CALL_RETRY_POLICY : DEFAULT_RETRY_POLICY;

    try {
      const { value: result, attempt } = await withRetry(
        () => executor({ config: resolvedConfig, resolvedInput, ctx }),
        retryPolicy,
        signal,
      );
      const finishedAt = new Date();
      outputs.set(node.id, result.output);
      if (kind === "output") finalOutputs.push(resolvedInput.in ?? resolvedInput);
      totalInputTokens += result.inputTokens ?? 0;
      totalOutputTokens += result.outputTokens ?? 0;
      totalCostCents += result.costCents ?? 0;

      await onStepEnd?.({
        nodeId: node.id,
        stepIndex: currentStepIndex,
        name: node.data.label,
        kind,
        status: "succeeded",
        startedAt,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        input: resolvedInput,
        output: result.output,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costCents: result.costCents,
        attempt,
      });
    } catch (error) {
      if (isAbortError(error)) {
        cancelled = true;
        break;
      }
      const finishedAt = new Date();
      failed.add(node.id);
      const message = error instanceof Error ? error.message : String(error);
      runFailedMessage = runFailedMessage ?? `${node.data.label}: ${message}`;

      await onStepEnd?.({
        nodeId: node.id,
        stepIndex: currentStepIndex,
        name: node.data.label,
        kind,
        status: "failed",
        startedAt,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        input: resolvedInput,
        output: null,
        attempt: retryPolicy.maxAttempts,
        errorMessage: message,
      });
    }
  }

  if (cancelled) {
    return { status: "cancelled", finalOutputs, totalInputTokens, totalOutputTokens, totalCostCents };
  }
  if (failed.size > 0) {
    return { status: "failed", finalOutputs, totalInputTokens, totalOutputTokens, totalCostCents, errorMessage: runFailedMessage };
  }
  return { status: "succeeded", finalOutputs, totalInputTokens, totalOutputTokens, totalCostCents };
}
