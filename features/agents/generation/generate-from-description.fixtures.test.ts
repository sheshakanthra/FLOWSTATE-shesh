import { describe, expect, it } from "vitest";
import { generateAgentFromDescription } from "./generate-from-description";
import { validateGraph } from "../lib/validate-graph";

/**
 * E1 gate item 2: "Ten fixture inputs in plain English produce valid,
 * runnable graphs in at least nine cases. Commit the fixtures as a test."
 *
 * A real integration test against the live Groq provider -- the same call
 * path `/api/demo/generate` (and C3's `create_agent_from_description`)
 * uses -- not a mocked-LLM unit test. The gate's own claim is about what
 * the *real* model produces for these ten real descriptions; a hand-written
 * stub plan would only prove `assembleGraph`/`validateGraph` accept
 * whatever shape I fed them, which isn't what this gate item is asking to
 * be proven. `it.skipIf` guards environments with no `GROQ_API_KEY` (CI
 * without the secret configured) rather than failing outright -- this
 * codebase has no other committed test that depends on a live provider
 * call, so there's no existing convention for that secret being required.
 */
export const FIXTURE_DESCRIPTIONS = [
  "Follow up with every lead who hasn't responded in 3 days",
  "Summarize inbound support tickets every morning and post the summary to Slack",
  "Qualify inbound leads from our contact form and notify sales when one is a good fit",
  "Draft a weekly report of client account activity",
  "Watch our shared inbox for new invoices and log them to a spreadsheet",
  "Post a daily digest of new GitHub issues to the team channel",
  "Remind clients about upcoming contract renewal dates",
  "Turn raw meeting notes into a task list",
  "Check competitor pricing pages weekly and flag anything that changed",
  "Draft a client proposal from a completed intake form",
] as const;

describe("generateAgentFromDescription fixtures (E1 gate item 2)", () => {
  it.skipIf(!process.env.GROQ_API_KEY)(
    "produces a valid, runnable graph for at least 9 of the 10 real fixture descriptions",
    async () => {
      // Sequential, not `Promise.all`, *and* paced ~20s apart -- ten
      // concurrent requests hit Groq's per-account rate limit outright
      // (spurious "didn't return a usable agent plan" JSON-parse failures),
      // and even ten *sequential* requests fired back-to-back still blew
      // through this account's real 8000-tokens-per-minute cap for this
      // model (each generation call runs ~2500-2700 tokens) partway
      // through the run. 20s of spacing keeps cumulative usage under that
      // budget within any rolling 60s window.
      const results: { description: string; ok: boolean; issues: unknown[] }[] = [];
      for (const [index, description] of FIXTURE_DESCRIPTIONS.entries()) {
        if (index > 0) await new Promise((resolve) => setTimeout(resolve, 20_000));
        try {
          const generated = await generateAgentFromDescription(description);
          const issues = validateGraph(
            generated.graph.nodes.map((node) => ({ id: node.id, type: node.type, data: node.data })),
            generated.graph.edges,
          );
          results.push({ description, ok: issues.length === 0 && generated.graph.nodes.length > 0, issues });
        } catch (error) {
          results.push({
            description,
            ok: false,
            issues: [{ nodeId: null, message: error instanceof Error ? error.message : String(error) }],
          });
        }
      }

      const validCount = results.filter((result) => result.ok).length;
      const failures = results.filter((result) => !result.ok);
      expect(validCount, `Failures:\n${JSON.stringify(failures, null, 2)}`).toBeGreaterThanOrEqual(9);
    },
    // Ten real, rate-limit-paced Groq calls (~20s apart) -- headroom over
    // the ~180s the pacing alone requires plus each call's own latency.
    300_000,
  );
});
