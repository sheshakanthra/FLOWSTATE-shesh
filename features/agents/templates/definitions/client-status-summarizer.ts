import { DEFAULT_GROQ_MODEL } from "@/lib/llm/models";
import type { TemplateDefinition } from "../types";

/** trigger -> transform -> knowledge -> llm -> output. `knowledge.results`
 *  (document) wires directly into `llm.context` (document) with no bridge
 *  needed -- the same direct compatibility Recall Scheduler's own seeded
 *  graph relies on. The Knowledge node's real executor returns an empty
 *  result set (no knowledge base exists in this build -- B4's decision),
 *  so the LLM's system prompt is written to produce a complete, sensible
 *  summary on its own rather than depending on retrieved context. */
export const clientStatusSummarizerTemplate: TemplateDefinition = {
  id: "client-status-summarizer",
  name: "Client Status Summarizer",
  description: "Turns this week's project notes into a client-ready status update.",
  nodes: [
    {
      id: "trigger",
      type: "trigger",
      position: { x: 0, y: 120 },
      data: { label: "Weekly check-in", config: { triggerType: "schedule", schedule: "0 9 * * 1" } },
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
      data: { label: "Recent project notes", config: { sourceId: "client-project-notes", topK: 5 } },
    },
    {
      id: "llm",
      type: "llm",
      position: { x: 660, y: 120 },
      data: {
        label: "Draft status update",
        config: {
          model: DEFAULT_GROQ_MODEL,
          systemPrompt:
            'You are an account manager\'s assistant at an AI automation agency. This week for client "Harbor & Vine": the review-response agent shipped and is live, the onboarding automation is 80% built with one blocker (waiting on their CRM API key), and the next milestone is a demo next Tuesday. Write a warm, professional client-facing status update under 150 words covering what\'s done, what\'s blocked, and what\'s next.',
          temperature: 0.6,
        },
      },
    },
    {
      id: "output",
      type: "output",
      position: { x: 880, y: 120 },
      data: { label: "Send to client", config: { destination: "client-email" } },
    },
  ],
  edges: [
    { id: "e1", source: "trigger", sourceHandle: "out", target: "transform", targetHandle: "input" },
    { id: "e2", source: "transform", sourceHandle: "output", target: "knowledge", targetHandle: "query" },
    { id: "e3", source: "knowledge", sourceHandle: "results", target: "llm", targetHandle: "context" },
    { id: "e4", source: "llm", sourceHandle: "response", target: "output", targetHandle: "in" },
  ],
};
