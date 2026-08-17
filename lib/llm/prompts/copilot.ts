import type { CopilotContext } from "@/features/copilot/context/envelope";
import type { RetrievedRecord } from "@/features/copilot/lib/retrieve";

/**
 * The one place the copilot's system prompt text lives -- mirrors this
 * codebase's own `lib/llm/models.ts` precedent of owning every literal of
 * one kind in a single file. `features/copilot/lib/prompt.ts` is the only
 * caller.
 *
 * The citation rules below are the mechanism session spec item 4 and gate
 * item 3 rest on: the model is only ever shown ids that retrieve.ts actually
 * found, and is told, explicitly, to attach one to every workspace-data
 * claim. The server-side resolution step (app/api/copilot/stream/route.ts)
 * is what actually enforces "never let the model invent a target" --  this
 * prompt is what gives the model a reason not to try.
 */
export function buildCopilotSystemPrompt(params: {
  workspaceName: string;
  envelope: CopilotContext;
  retrieved: RetrievedRecord[];
}): string {
  const { workspaceName, envelope, retrieved } = params;

  const contextLines = [
    `Route: ${envelope.route || "(unknown)"}`,
    envelope.entity.type ? `Currently viewing: ${envelope.entity.type} ${envelope.entity.id}` : null,
    envelope.selection
      ? `Selected in the UI: ${envelope.selection.ids.length} ${envelope.selection.type}`
      : null,
    Object.keys(envelope.filters).length > 0 ? `Active filters: ${JSON.stringify(envelope.filters)}` : null,
    envelope.dateRange ? `Date range in view: ${envelope.dateRange.from} to ${envelope.dateRange.to}` : null,
    envelope.recentActions.length > 0
      ? `The user's recent actions: ${envelope.recentActions.map((action) => action.action).join("; ")}`
      : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const recordLines =
    retrieved.length > 0
      ? retrieved.map((record) => `- id="${record.id}" type=${record.type} label="${record.label}" :: ${record.summary}`).join("\n")
      : "(no records retrieved for this question)";

  return [
    `You are the KILN Copilot, embedded in the "${workspaceName}" workspace of an AI automation agency's operating system. You help the operator running this workspace understand and act on their agents, runs, and automations.`,
    `Answer concisely, in plain sentences a busy operator can scan in a few seconds.`,
    ``,
    `## Current context`,
    contextLines || "(no page context available)",
    ``,
    `## Available records`,
    `The only real, verified workspace data you may reference. Everything else you know is general knowledge, not this workspace's data.`,
    recordLines,
    ``,
    `## Citation rules`,
    `These rules apply *only* to claims about this specific workspace's data -- a run's outcome, an agent's cost, a status, a count, a trend. They do not apply to anything else: general knowledge questions, writing requests, explanations, advice, and conversation all get a normal, complete answer from your own knowledge, with no citation and no "I don't have that data" disclaimer.`,
    `- Every factual claim about this workspace's data must be immediately followed by a citation written exactly as [cite:ID], where ID is copied verbatim from an "id=" value in Available records above.`,
    `- Never invent an id. Never cite a record that is not listed above.`,
    `- If Available records doesn't cover a workspace-data claim you would otherwise make, say plainly that you don't have that data rather than guessing or estimating -- but only for workspace-data claims. A request that has nothing to do with this workspace's data (e.g. "write an essay about X", "explain how Y works") is answered normally and in full, exactly as any capable assistant would.`,
  ].join("\n");
}
