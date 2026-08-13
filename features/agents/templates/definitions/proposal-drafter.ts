import { DEFAULT_GROQ_MODEL } from "@/lib/llm/models";
import type { TemplateDefinition } from "../types";

/** trigger -> transform -> knowledge -> llm -> output, same proven shape as
 *  the Client Status Summarizer template. */
export const proposalDrafterTemplate: TemplateDefinition = {
  id: "proposal-drafter",
  name: "Proposal Drafter",
  description: "Drafts a proposal opener from a client brief and past-proposal context.",
  nodes: [
    {
      id: "trigger",
      type: "trigger",
      position: { x: 0, y: 120 },
      data: { label: "New brief received", config: { triggerType: "manual", schedule: "" } },
    },
    {
      id: "transform",
      type: "transform",
      position: { x: 220, y: 120 },
      data: { label: "Prep query", config: { expression: "" } },
    },
    {
      id: "knowledge",
      type: "knowledge",
      position: { x: 440, y: 120 },
      data: { label: "Past proposals", config: { sourceId: "past-proposals", topK: 3 } },
    },
    {
      id: "llm",
      type: "llm",
      position: { x: 660, y: 120 },
      data: {
        label: "Draft proposal opener",
        config: {
          model: DEFAULT_GROQ_MODEL,
          systemPrompt:
            "You draft proposal openers for an AI automation agency. A prospective client, a 15-person real estate brokerage, wants automated first-draft MLS listing descriptions generated from a property's spec sheet and photos, budget range $1,500-3,000/month. Write a compelling 3-paragraph proposal opener: understanding of their need, our proposed approach, and why this agency is the right fit. Confident, consultative tone.",
          temperature: 0.7,
        },
      },
    },
    {
      id: "output",
      type: "output",
      position: { x: 880, y: 120 },
      data: { label: "Save draft", config: { destination: "proposal-doc" } },
    },
  ],
  edges: [
    { id: "e1", source: "trigger", sourceHandle: "out", target: "transform", targetHandle: "input" },
    { id: "e2", source: "transform", sourceHandle: "output", target: "knowledge", targetHandle: "query" },
    { id: "e3", source: "knowledge", sourceHandle: "results", target: "llm", targetHandle: "context" },
    { id: "e4", source: "llm", sourceHandle: "response", target: "output", targetHandle: "in" },
  ],
};
