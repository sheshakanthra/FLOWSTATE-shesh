import type { LLMToolSpec } from "@/lib/llm/provider";
import { createAgentTool } from "./definitions/create-agent";
import { draftMessageTool } from "./definitions/draft-message";
import { explainRunTool } from "./definitions/explain-run";
import { modifyAgentTool } from "./definitions/modify-agent";
import { searchRunsTool } from "./definitions/search-runs";
import { summarizeActivityTool } from "./definitions/summarize-activity";
import type { AnyToolDefinition, ToolDefinition } from "./types";

const registry = new Map<string, AnyToolDefinition>();

/**
 * "Adding a tool means adding one file" (spec item 1): a definition file
 * exports one `ToolDefinition` object, and this registers it below -- not
 * self-registration via a side-effect import, which would make this module
 * and every definition file circularly import each other (registry.ts's own
 * bottom imports pulling in a definitions/*.ts file that itself imports
 * `registerTool` back from registry.ts). `features/agents/nodes/registry.ts`
 * sidesteps the identical problem the identical way: the registry imports
 * plain data and calls its own registration function, never the reverse.
 *
 * The cast is the one contained point where a specific tool's real
 * input/preview/commit types are erased to the registry's own
 * untyped-at-rest storage -- sound because a definition's `run`/`commit`
 * are only ever invoked with input that already passed *that same
 * definition's* `inputSchema` (features/copilot/actions/execute.ts), never
 * another tool's.
 */
function registerTool<TInput, TPreviewData, TCommitPayload>(
  definition: ToolDefinition<TInput, TPreviewData, TCommitPayload>,
): void {
  if (registry.has(definition.name)) {
    throw new Error(`Tool "${definition.name}" is already registered.`);
  }
  registry.set(definition.name, definition as unknown as AnyToolDefinition);
}

export function getTool(name: string): AnyToolDefinition | undefined {
  return registry.get(name);
}

export function listTools(): AnyToolDefinition[] {
  return Array.from(registry.values());
}

/** What the LLM provider's `tools` param needs -- name/description/JSON
 *  schema only, never the executor or preview kind (the model has no
 *  business knowing how its own output gets rendered or persisted). */
export function toLLMToolSpecs(): LLMToolSpec[] {
  return listTools().map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters }));
}

// The one place that has to know about every tool file -- adding a seventh
// tool means adding its import above plus one line below. Nothing else in
// the codebase special-cases a tool by name: the stream route, the execute
// route, and the approval card all consume `getTool()`/`listTools()`
// generically.
registerTool(createAgentTool);
registerTool(explainRunTool);
registerTool(modifyAgentTool);
registerTool(summarizeActivityTool);
registerTool(searchRunsTool);
registerTool(draftMessageTool);
