import { DEFAULT_GROQ_MODEL } from "@/lib/llm/models";
import type { TemplateDefinition } from "../types";

/** trigger -> transform -> llm -> condition -> output, same proven shape as
 *  the Lead Qualifier template -- Condition's empty expression means the
 *  `true` branch always fires for a real (non-empty) LLM response, so the
 *  triage note always reaches Output. */
export const supportTriageTemplate: TemplateDefinition = {
  id: "support-triage",
  name: "Support Ticket Triage",
  description: "Classifies an inbound support ticket's severity and routes it to the right owner.",
  nodes: [
    {
      id: "trigger",
      type: "trigger",
      position: { x: 0, y: 120 },
      data: { label: "Ticket received", config: { triggerType: "webhook", schedule: "" } },
    },
    {
      id: "transform",
      type: "transform",
      position: { x: 220, y: 120 },
      data: { label: "Prep ticket", config: { expression: "" } },
    },
    {
      id: "llm",
      type: "llm",
      position: { x: 440, y: 120 },
      data: {
        label: "Triage ticket",
        config: {
          model: DEFAULT_GROQ_MODEL,
          systemPrompt:
            'You triage inbound support tickets for an AI automation agency\'s client portal. Ticket: Subject "Automation stopped sending replies" -- Body: "Our review responder hasn\'t posted anything in 3 days and we have 5 unanswered reviews sitting there." Classify severity (Critical/High/Medium/Low), identify the product area, and write a one-sentence internal routing note for the on-call engineer.',
          temperature: 0.4,
        },
      },
    },
    {
      id: "condition",
      type: "condition",
      position: { x: 660, y: 120 },
      data: { label: "Needs immediate page?", config: { expression: "" } },
    },
    {
      id: "output",
      type: "output",
      position: { x: 880, y: 120 },
      data: { label: "Route ticket", config: { destination: "on-call-engineer" } },
    },
  ],
  edges: [
    { id: "e1", source: "trigger", sourceHandle: "out", target: "transform", targetHandle: "input" },
    { id: "e2", source: "transform", sourceHandle: "output", target: "llm", targetHandle: "prompt" },
    { id: "e3", source: "llm", sourceHandle: "response", target: "condition", targetHandle: "in" },
    { id: "e4", source: "condition", sourceHandle: "true", target: "output", targetHandle: "in" },
  ],
};
