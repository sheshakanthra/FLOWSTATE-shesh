import { leadQualifierTemplate } from "./lead-qualifier";
import { clientStatusSummarizerTemplate } from "./client-status-summarizer";
import { meetingNotesToTasksTemplate } from "./meeting-notes-to-tasks";
import { proposalDrafterTemplate } from "./proposal-drafter";
import { supportTriageTemplate } from "./support-triage";
import { weeklyReportTemplate } from "./weekly-report";

/** All 6 (session spec item 6: "6 real templates, not placeholders") --
 *  every one instantiates into a real, `validateGraph`-clean, actually-
 *  runnable graph, verified against real Groq this session (see
 *  PROGRESS.md's B6 decisions). Order here is the gallery's display order. */
export const TEMPLATES = [
  leadQualifierTemplate,
  clientStatusSummarizerTemplate,
  meetingNotesToTasksTemplate,
  proposalDrafterTemplate,
  supportTriageTemplate,
  weeklyReportTemplate,
];

export function getTemplate(id: string) {
  return TEMPLATES.find((template) => template.id === id);
}
