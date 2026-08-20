import { z } from "zod";
import { runStatusEnum } from "@/db/schema";
import { listRunsForWorkspace } from "@/lib/repos/runs";
import type { ToolDefinition } from "../types";

const inputSchema = z.object({
  status: z.enum(runStatusEnum.enumValues).optional(),
  agentName: z.string().min(1).max(200).optional(),
  days: z.number().int().positive().max(365).optional(),
});
type Input = z.infer<typeof inputSchema>;

export interface SearchRunsRow {
  id: string;
  agentName: string;
  status: string;
  startedAt: string;
  durationMs: number | null;
  costUsd: number | null;
  href: string;
}

interface PreviewData {
  rows: SearchRunsRow[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ROW_LIMIT = 25;

/** Read-only. "Structured query over run history" (spec item 2) --
 *  `lib/repos/runs.ts#listRunsForWorkspace` already supports status/since/
 *  limit; agent-name matching is a simple case-insensitive substring filter
 *  applied after the fetch, since the repo has no text-search column to
 *  push it into and the result set here is small enough (bounded by
 *  ROW_LIMIT) that doing it in application code costs nothing real. */
export const searchRunsTool: ToolDefinition<Input, PreviewData, never> = {
  name: "search_runs",
  description:
    "Searches recent agent runs by status, agent name, and how far back to look. Use this when the user asks to find, list, or filter runs -- e.g. \"show me failed runs from the last week\".",
  inputSchema,
  parameters: {
    type: "object",
    properties: {
      status: { type: "string", enum: [...runStatusEnum.enumValues], description: "Filter by run status." },
      agentName: { type: "string", description: "Filter by a substring of the agent's name." },
      days: { type: "number", description: "How many days back to search. Defaults to 30." },
    },
    required: [],
  },
  requiredRole: "member",
  mutates: false,
  async run(input, ctx) {
    const days = input.days ?? 30;
    const since = new Date(Date.now() - days * DAY_MS);
    const runs = await listRunsForWorkspace(ctx.workspaceId, { since, status: input.status, limit: 100 });

    const filtered = input.agentName
      ? runs.filter((run) => run.agentName.toLowerCase().includes(input.agentName!.toLowerCase()))
      : runs;

    const rows: SearchRunsRow[] = filtered.slice(0, ROW_LIMIT).map((run) => ({
      id: run.id,
      agentName: run.agentName,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      durationMs: run.durationMs,
      costUsd: run.costUsd,
      href: `/w/${ctx.workspaceSlug}/agents/${run.agentId}/runs/${run.id}`,
    }));

    return {
      preview: {
        kind: "table",
        summary: `Found ${filtered.length} run${filtered.length === 1 ? "" : "s"}${filtered.length > ROW_LIMIT ? ` (showing ${ROW_LIMIT})` : ""}`,
        data: { rows },
      },
    };
  },
};
