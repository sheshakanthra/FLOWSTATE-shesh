import { listAgentsForIndex } from "@/lib/repos/agents";
import { listRunsForWorkspace, type RunStatus } from "@/lib/repos/runs";
import type { CopilotContext } from "../context/envelope";

/**
 * Session spec item 4: "the server retrieves the relevant records, includes
 * them in the prompt with ids, and instructs the model to cite them." This
 * is the retrieval half -- lib/llm/prompts/copilot.ts turns the result into
 * prompt text, and app/api/copilot/stream/route.ts resolves the model's
 * citation markers back against exactly this list, dropping anything that
 * doesn't match an id here (the spec's own Notes: "do not let the model
 * invent citation targets").
 */
export interface RetrievedRecord {
  id: string;
  type: "agent" | "run";
  label: string;
  href: string;
  summary: string;
}

const STATUS_KEYWORDS: { pattern: RegExp; status: RunStatus }[] = [
  { pattern: /\bfail(?:ed|ing|ures?)?\b/i, status: "failed" },
  { pattern: /\bsucceed(?:ed|s)?\b|\bsuccess(?:ful)?\b/i, status: "succeeded" },
  { pattern: /\bcancell?ed\b/i, status: "cancelled" },
  { pattern: /\brunning\b|\bin.progress\b/i, status: "running" },
];

function inferStatus(message: string): RunStatus | undefined {
  for (const { pattern, status } of STATUS_KEYWORDS) {
    if (pattern.test(message)) return status;
  }
  return undefined;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A best-effort reading of "this week"/"today"/etc. straight out of the
 *  question text, falling back to the envelope's own dateRange contribution
 *  (a runs-table filter, say) and finally to a 30-day default -- "recent"
 *  should mean something even when the user doesn't spell out a window. */
function inferSince(message: string, envelope: CopilotContext): Date {
  if (envelope.dateRange) return new Date(envelope.dateRange.from);
  if (/\btoday\b/i.test(message)) return new Date(Date.now() - DAY_MS);
  if (/\byesterday\b/i.test(message)) return new Date(Date.now() - 2 * DAY_MS);
  if (/\b(?:this|last|past)\s+(?:week|7\s*days)\b/i.test(message)) return new Date(Date.now() - 7 * DAY_MS);
  if (/\b(?:this|last|past)\s+(?:month|30\s*days)\b/i.test(message)) return new Date(Date.now() - 30 * DAY_MS);
  return new Date(Date.now() - 30 * DAY_MS);
}

const RUN_LIMIT = 20;
const AGENT_LIMIT = 15;
const TOTAL_LIMIT = 25;

/**
 * Deliberately unconditional -- called for every message, not just ones that
 * "look like" a data question. The alternative (a keyword gate deciding
 * whether to bother) would need its own heuristic to get right, and getting
 * it wrong in the strict direction is the failure mode this whole feature
 * exists to prevent: a real data question the gate happened to miss,
 * answered from the model's own guesswork with nothing to check it against.
 * A cheap, bounded query on every turn costs far less than that risk.
 * Sentences that aren't about workspace data simply never end up flagged by
 * the unsourced-claim check downstream (features/copilot/messages/markdown.tsx),
 * so retrieving unconditionally doesn't make a plain "hello" read as
 * unverified.
 */
export async function retrieveContext(params: {
  workspaceId: string;
  workspaceSlug: string;
  message: string;
  envelope: CopilotContext;
}): Promise<RetrievedRecord[]> {
  const { workspaceId, workspaceSlug, message, envelope } = params;
  const status = inferStatus(message);
  const since = inferSince(message, envelope);

  const [agentsIndex, runs] = await Promise.all([
    listAgentsForIndex(workspaceId),
    listRunsForWorkspace(workspaceId, { since, status, limit: RUN_LIMIT }),
  ]);

  const records: RetrievedRecord[] = [];

  for (const run of runs) {
    records.push({
      id: run.id,
      type: "run",
      label: `${run.agentName} — ${run.status} run`,
      href: `/w/${workspaceSlug}/agents/${run.agentId}/runs/${run.id}`,
      summary: [
        `agent: ${run.agentName}`,
        `status: ${run.status}`,
        `trigger: ${run.trigger}`,
        `started: ${run.startedAt.toISOString()}`,
        run.durationMs !== null ? `duration: ${run.durationMs}ms` : null,
        run.costUsd !== null ? `cost: $${run.costUsd.toFixed(4)}` : null,
        run.errorMessage ? `error: ${run.errorMessage}` : null,
      ]
        .filter((part): part is string => part !== null)
        .join(", "),
    });
  }

  for (const agent of agentsIndex.slice(0, AGENT_LIMIT)) {
    records.push({
      id: agent.id,
      type: "agent",
      label: agent.name,
      href: `/w/${workspaceSlug}/agents/${agent.id}/build`,
      summary: [
        `status: ${agent.status}${agent.enabled ? "" : " (disabled)"}`,
        agent.successRate !== null ? `success rate: ${Math.round(agent.successRate * 100)}%` : "never run",
        `cost last 7 days: $${agent.costLast7DaysUsd.toFixed(4)}`,
        agent.lastRunAt ? `last run: ${agent.lastRunAt.toISOString()} (${agent.lastRunStatus})` : null,
      ]
        .filter((part): part is string => part !== null)
        .join(", "),
    });
  }

  return records.slice(0, TOTAL_LIMIT);
}
