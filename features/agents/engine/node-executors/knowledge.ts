import type { KnowledgeConfig } from "../../nodes/types/knowledge";
import type { NodeExecutor } from "./types";

/**
 * No knowledge base exists in this codebase -- CLAUDE.md's own scope list
 * puts "knowledge base" out of scope for this entire build, not just this
 * session. An honest empty result (not a fabricated set of "found"
 * documents) is what this executor returns; a downstream LLM node's
 * `context` input resolving to an empty array is a real, correctly-handled
 * case (llm.ts skips appending a context block when it's empty), not an
 * error.
 */
export const knowledgeExecutor: NodeExecutor<KnowledgeConfig> = async () => {
  return { output: { results: [] as unknown[] } };
};
