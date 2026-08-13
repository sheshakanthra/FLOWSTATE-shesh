import { DEFAULT_GROQ_MODEL } from "@/lib/llm/models";
import type { TemplateDefinition } from "../types";

/**
 * trigger(signal) -> transform(any bridge) -> llm -> condition -> output,
 * the exact shape `db/seed.ts`'s Recall Scheduler graph proved end-to-end
 * against real Groq in B4/B5 -- Condition's expression is left empty
 * deliberately (same as that seed graph): with no `{{token}}` expression to
 * evaluate, `evaluateCondition` returns null and the executor falls back to
 * `Boolean(resolvedInput.in)`, which is true for any non-empty LLM response,
 * so the `true` branch fires and the drafted verdict reaches Output as this
 * run's real final output.
 */
export const leadQualifierTemplate: TemplateDefinition = {
  id: "lead-qualifier",
  name: "Inbound Lead Qualifier",
  description: "Scores a new inbound lead and drafts a qualification verdict for sales to act on.",
  nodes: [
    {
      id: "trigger",
      type: "trigger",
      position: { x: 0, y: 120 },
      data: { label: "New inbound lead", config: { triggerType: "webhook", schedule: "" } },
    },
    {
      id: "transform",
      type: "transform",
      position: { x: 220, y: 120 },
      data: { label: "Prep lead details", config: { expression: "" } },
    },
    {
      id: "llm",
      type: "llm",
      position: { x: 440, y: 120 },
      data: {
        label: "Qualify lead",
        config: {
          model: DEFAULT_GROQ_MODEL,
          systemPrompt:
            "You are a B2B sales qualification assistant for an AI automation agency. A new inbound lead just came in: a 40-person marketing agency asking about automating their client onboarding paperwork, budget mentioned as roughly $2,000/month. Write a qualification verdict: Qualified or Not Qualified, a 0-100 fit score, and 2-3 sentences of reasoning an account executive could act on immediately.",
          temperature: 0.6,
        },
      },
    },
    {
      id: "condition",
      type: "condition",
      position: { x: 660, y: 120 },
      data: { label: "Worth a call?", config: { expression: "" } },
    },
    {
      id: "output",
      type: "output",
      position: { x: 880, y: 120 },
      data: { label: "Notify sales", config: { destination: "sales-team-notification" } },
    },
  ],
  edges: [
    { id: "e1", source: "trigger", sourceHandle: "out", target: "transform", targetHandle: "input" },
    { id: "e2", source: "transform", sourceHandle: "output", target: "llm", targetHandle: "prompt" },
    { id: "e3", source: "llm", sourceHandle: "response", target: "condition", targetHandle: "in" },
    { id: "e4", source: "condition", sourceHandle: "true", target: "output", targetHandle: "in" },
  ],
};
