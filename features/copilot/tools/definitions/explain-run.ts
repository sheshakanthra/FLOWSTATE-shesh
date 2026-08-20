import { z } from "zod";
import { getRunDetail, listRunSteps } from "@/lib/repos/runs";
import type { ToolDefinition } from "../types";

const inputSchema = z.object({
  runId: z.string().min(1),
});
type Input = z.infer<typeof inputSchema>;

interface PreviewData {
  runId: string;
  href: string;
  text: string;
}

/** Read-only (spec item 3): executes immediately, no approval. Reads the
 *  run's own recorded steps (lib/repos/runs.ts -- B4/B5's real execution
 *  history, not a re-run) and explains the first failure it finds using the
 *  step's *resolved* input/output/error exactly as recorded, never a
 *  fabricated guess at what happened. */
export const explainRunTool: ToolDefinition<Input, PreviewData, never> = {
  name: "explain_run",
  description:
    "Explains why a specific agent run failed (or summarizes what it did, if it succeeded), using that run's own recorded steps. Requires the run's id.",
  inputSchema,
  parameters: {
    type: "object",
    properties: { runId: { type: "string", description: "The agent run's id." } },
    required: ["runId"],
  },
  requiredRole: "member",
  mutates: false,
  async run(input, ctx) {
    const run = await getRunDetail(ctx.workspaceId, input.runId);
    if (!run) throw new Error("No run with that id exists in this workspace.");

    const steps = await listRunSteps(ctx.workspaceId, run.id);
    const href = `/w/${ctx.workspaceSlug}/agents/${run.agentId}/runs/${run.id}`;

    if (run.status === "failed") {
      const failedStep = steps.find((step) => step.status === "failed") ?? steps.at(-1) ?? null;
      const lines = [
        `This run failed${run.errorMessage ? `: ${run.errorMessage}` : "."}`,
        failedStep
          ? `It failed at step "${failedStep.name}" (${failedStep.kind}), step ${failedStep.stepIndex + 1} of ${steps.length}.`
          : null,
        failedStep?.input ? `That step's resolved input: ${JSON.stringify(failedStep.input)}` : null,
        failedStep?.errorMessage ? `Step error: ${failedStep.errorMessage}` : null,
      ].filter((line): line is string => line !== null);
      return { preview: { kind: "text", summary: "Explained why this run failed", data: { runId: run.id, href, text: lines.join("\n") } } };
    }

    if (run.status === "running") {
      return {
        preview: {
          kind: "text",
          summary: "This run is still in progress",
          data: { runId: run.id, href, text: `This run started ${run.startedAt.toISOString()} and hasn't finished yet -- ${steps.length} step(s) recorded so far.` },
        },
      };
    }

    const outcome = run.status === "succeeded" ? "succeeded" : "was cancelled";
    const lines = [
      `This run ${outcome}, completing ${steps.length} step${steps.length === 1 ? "" : "s"}${run.durationMs !== null ? ` in ${run.durationMs}ms` : ""}.`,
      run.costUsd !== null ? `Cost: $${run.costUsd.toFixed(4)}.` : null,
    ].filter((line): line is string => line !== null);
    return { preview: { kind: "text", summary: `This run ${outcome}`, data: { runId: run.id, href, text: lines.join("\n") } } };
  },
};
