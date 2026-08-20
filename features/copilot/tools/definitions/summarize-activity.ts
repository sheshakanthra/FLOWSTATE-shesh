import { z } from "zod";
import { listActivityEvents } from "@/lib/repos/activity";
import { listAgentsForIndex } from "@/lib/repos/agents";
import { listRunsForWorkspace } from "@/lib/repos/runs";
import type { ToolDefinition } from "../types";

const inputSchema = z.object({
  days: z.number().int().positive().max(90).optional(),
});
type Input = z.infer<typeof inputSchema>;

interface PreviewData {
  text: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Read-only. A computed report, not a second LLM call over the raw rows --
 *  keeping the number in "12 runs, 2 failed" traceable to a real query
 *  result matters more here than natural prose would add, and it keeps this
 *  tool a single round trip. */
export const summarizeActivityTool: ToolDefinition<Input, PreviewData, never> = {
  name: "summarize_activity",
  description:
    "Summarizes what happened in the workspace over a recent date range: run counts and outcomes, top-cost agents, and recent activity events. Use this when the user asks for a recap, digest, or overview of recent activity.",
  inputSchema,
  parameters: {
    type: "object",
    properties: { days: { type: "number", description: "How many days back to summarize. Defaults to 7." } },
    required: [],
  },
  requiredRole: "member",
  mutates: false,
  async run(input, ctx) {
    const days = input.days ?? 7;
    const since = new Date(Date.now() - days * DAY_MS);

    const [runs, events, agents] = await Promise.all([
      listRunsForWorkspace(ctx.workspaceId, { since, limit: 200 }),
      listActivityEvents(ctx.workspaceId, { since, limit: 10 }),
      listAgentsForIndex(ctx.workspaceId),
    ]);

    const succeeded = runs.filter((run) => run.status === "succeeded").length;
    const failed = runs.filter((run) => run.status === "failed").length;
    const totalCost = runs.reduce((sum, run) => sum + (run.costUsd ?? 0), 0);

    const byAgent = new Map<string, { name: string; failures: number }>();
    for (const run of runs) {
      if (run.status !== "failed") continue;
      const entry = byAgent.get(run.agentId) ?? { name: run.agentName, failures: 0 };
      entry.failures += 1;
      byAgent.set(run.agentId, entry);
    }
    const topFailing = [...byAgent.values()].sort((a, b) => b.failures - a.failures).slice(0, 3);

    const lines = [
      `Over the last ${days} day${days === 1 ? "" : "s"}: ${runs.length} run${runs.length === 1 ? "" : "s"} (${succeeded} succeeded, ${failed} failed), totaling $${totalCost.toFixed(4)}.`,
      topFailing.length > 0 ? `Most failures: ${topFailing.map((entry) => `${entry.name} (${entry.failures})`).join(", ")}.` : null,
      `${agents.length} agent${agents.length === 1 ? "" : "s"} in this workspace.`,
      events.length > 0 ? `Recent activity: ${events.slice(0, 5).map((event) => event.summary).join("; ")}.` : null,
    ].filter((line): line is string => line !== null);

    return { preview: { kind: "text", summary: `Summarized the last ${days} days`, data: { text: lines.join("\n") } } };
  },
};
