import { DEFAULT_GROQ_MODEL } from "@/lib/llm/models";
import type { TemplateDefinition } from "../types";

/**
 * The one template that exercises a Tool node, to demonstrate that node
 * type genuinely working in a real, runnable graph -- not just Trigger/
 * Transform/LLM/Condition/Output like the other five. Needs a bridge on
 * *both* sides of Tool: trigger's `signal` output isn't compatible with
 * Tool's `json` input (so `transform-in` bridges it, same reason every
 * other template bridges trigger straight into a typed port), and Tool's
 * `json` output isn't compatible with LLM's `document`-typed `context`
 * input either (`transform-out` bridges that side). Both bridges are
 * genuine port-type requirements, not decoration -- `arePortTypesCompatible`
 * has no `json`<->`document` special case.
 */
export const weeklyReportTemplate: TemplateDefinition = {
  id: "weekly-report",
  name: "Weekly Report Generator",
  description: "Pulls this week's metrics and writes a short ops report for leadership.",
  nodes: [
    {
      id: "trigger",
      type: "trigger",
      position: { x: 0, y: 120 },
      data: { label: "Friday 4pm", config: { triggerType: "schedule", schedule: "0 16 * * 5" } },
    },
    {
      id: "transform-in",
      type: "transform",
      position: { x: 220, y: 120 },
      data: { label: "Prep request", config: { expression: "" } },
    },
    {
      id: "tool",
      type: "tool",
      position: { x: 440, y: 120 },
      data: { label: "Fetch weekly metrics", config: { toolId: "fetch-weekly-metrics" } },
    },
    {
      id: "transform-out",
      type: "transform",
      position: { x: 660, y: 120 },
      data: { label: "Prep report context", config: { expression: "" } },
    },
    {
      id: "llm",
      type: "llm",
      position: { x: 880, y: 120 },
      data: {
        label: "Write weekly report",
        config: {
          model: DEFAULT_GROQ_MODEL,
          systemPrompt:
            "You write weekly ops reports for agency leadership. This week: 142 agent runs across 4 clients, 96% success rate, $4.82 total spend, one incident (a client's insurance-verification agent failed repeatedly due to an expired portal login, now resolved). Write a concise weekly summary under 120 words: headline number, one win, one risk, and a recommended focus for next week. Plain language, no fluff.",
          temperature: 0.5,
        },
      },
    },
    {
      id: "output",
      type: "output",
      position: { x: 1100, y: 120 },
      data: { label: "Send digest", config: { destination: "leadership-digest" } },
    },
  ],
  edges: [
    { id: "e1", source: "trigger", sourceHandle: "out", target: "transform-in", targetHandle: "input" },
    { id: "e2", source: "transform-in", sourceHandle: "output", target: "tool", targetHandle: "input" },
    { id: "e3", source: "tool", sourceHandle: "output", target: "transform-out", targetHandle: "input" },
    { id: "e4", source: "transform-out", sourceHandle: "output", target: "llm", targetHandle: "context" },
    { id: "e5", source: "llm", sourceHandle: "response", target: "output", targetHandle: "in" },
  ],
};
