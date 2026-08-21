import { assembleGraph, type GeneratedAgent, type GeneratedPlan } from "@/features/agents/generation/generate-from-description";
import type { AgentNode } from "@/features/agents/nodes/registry";

/**
 * Session spec item 5: "If generation fails or times out, fall back to a
 * pre-built example graph with a quiet note. Never an error screen. Never a
 * blank canvas." This graph is assembled through the exact same
 * `assembleGraph` a real generated plan goes through (see that function's
 * own doc comment) rather than a second, hand-wired node/edge array, so it's
 * guaranteed structurally valid -- bridge nodes inserted wherever two
 * adjacent ports aren't type-compatible, positions laid out, ids minted --
 * with zero risk of drifting out of sync with the port-type system as new
 * node types are added.
 *
 * The run trace is precomputed too, not a real second Groq call against
 * this graph: the whole reason this path exists is "generation didn't work,
 * or the network/LLM is unreachable" -- a fallback that itself depends on a
 * live model call would fail for the exact same reason the real attempt
 * did. A visitor who forced this path (or who's on a flaky connection when
 * the demo genuinely can't reach Groq) still gets a complete, coherent
 * demo: a real graph, a real-looking run, a real final answer.
 */
const FALLBACK_PLAN: GeneratedPlan = {
  name: "Inbound Lead Qualifier",
  description:
    "Reads a new inbound lead, drafts a qualification summary, and notifies sales when it's a good fit.",
  steps: [
    { type: "trigger", label: "New inbound lead", config: { triggerType: "webhook" } },
    {
      type: "llm",
      label: "Qualify the lead",
      config: {
        systemPrompt:
          "Read the lead's message and company details, decide whether they fit our ideal customer profile, and summarize why in two sentences.",
      },
    },
    { type: "condition", label: "Good fit?", config: { expression: "true" } },
    { type: "tool", label: "Notify sales", config: { toolId: "slack.send_message" } },
    { type: "output", label: "Log outcome", config: { destination: "crm" } },
  ],
};

const FALLBACK_OUTPUT_BY_TYPE: Record<string, string> = {
  trigger: "Received a new lead from the webhook.",
  transform: "Passed the value through unchanged.",
  llm: 'Qualified — the message names a 40-seat rollout starting next quarter and a named budget owner. Matches ICP.',
  condition: "Condition true — routing to the \"good fit\" branch.",
  tool: "Sent a message to #sales-inbound via Slack.",
  output: "Logged the outcome to the CRM.",
};

export interface FallbackStep {
  nodeId: string;
  name: string;
  kind: string;
  output: string;
}

export interface FallbackDemo {
  name: string;
  description: string;
  graph: GeneratedAgent["graph"];
  steps: FallbackStep[];
  finalOutput: string;
}

function outputFor(node: AgentNode): string {
  return FALLBACK_OUTPUT_BY_TYPE[node.type ?? ""] ?? "Done.";
}

/** Rebuilt fresh on each call (cheap -- five plain-object nodes, no
 *  network) rather than a module-level singleton, so every fallback ids
 *  are unique per visitor session and nothing can leak between two
 *  concurrent demo sessions on the server. */
export function buildFallbackDemo(): FallbackDemo {
  const graph = assembleGraph(FALLBACK_PLAN);
  const steps: FallbackStep[] = graph.nodes.map((node) => ({
    nodeId: node.id,
    name: node.data.label,
    kind: node.type ?? "node",
    output: outputFor(node),
  }));
  const finalOutput =
    "Qualified: the lead names a 40-seat rollout and a Q3 start date, matching our ICP. Notified #sales-inbound and logged the outcome to the CRM.";

  return { name: FALLBACK_PLAN.name, description: FALLBACK_PLAN.description, graph, steps, finalOutput };
}
