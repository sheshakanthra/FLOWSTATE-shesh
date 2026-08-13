import { DEFAULT_GROQ_MODEL } from "@/lib/llm/models";
import type { TemplateDefinition } from "../types";

/** The simplest shape any template needs: trigger -> transform -> llm ->
 *  output. The transform bridge exists purely to turn the trigger's
 *  `signal` output into something `llm.prompt` (`text`) or `llm.context`
 *  (`document`) will accept -- ports-type compatibility, not a meaningful
 *  processing step (its own expression is empty, so it's a pure passthrough,
 *  same as every other template's bridge node). */
export const meetingNotesToTasksTemplate: TemplateDefinition = {
  id: "meeting-notes-to-tasks",
  name: "Meeting Notes → Tasks",
  description: "Extracts a clean action-item list from raw meeting notes.",
  nodes: [
    {
      id: "trigger",
      type: "trigger",
      position: { x: 0, y: 120 },
      data: { label: "Notes submitted", config: { triggerType: "manual", schedule: "" } },
    },
    {
      id: "transform",
      type: "transform",
      position: { x: 220, y: 120 },
      data: { label: "Prep notes", config: { expression: "" } },
    },
    {
      id: "llm",
      type: "llm",
      position: { x: 440, y: 120 },
      data: {
        label: "Extract action items",
        config: {
          model: DEFAULT_GROQ_MODEL,
          systemPrompt:
            "You turn raw meeting notes into action items. Here are notes from today's client kickoff call: \"Discussed scope -- client wants lead scoring by end of month, Priya to send a proposal draft by Friday, client needs to share their CRM export before we can start, Jordan will schedule the technical walkthrough next week.\" Extract every task as a bulleted list: \"- [Owner] Task (Due: date or 'unspecified')\". Do not invent tasks that weren't mentioned.",
          temperature: 0.3,
        },
      },
    },
    {
      id: "output",
      type: "output",
      position: { x: 660, y: 120 },
      data: { label: "Post to task tracker", config: { destination: "task-tracker" } },
    },
  ],
  edges: [
    { id: "e1", source: "trigger", sourceHandle: "out", target: "transform", targetHandle: "input" },
    { id: "e2", source: "transform", sourceHandle: "output", target: "llm", targetHandle: "prompt" },
    { id: "e3", source: "llm", sourceHandle: "response", target: "output", targetHandle: "in" },
  ],
};
