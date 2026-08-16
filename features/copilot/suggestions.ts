import type { CopilotContext } from "./context/envelope";

/**
 * Session spec item 6: the empty state offers three suggested prompts based
 * on where the user actually is. Pure and framework-free so gate item 8's
 * "prompts differ between /today and an agent build page" can be checked
 * both here and in a real browser.
 *
 * These read off the envelope, not off `usePathname` — which is the point of
 * having an envelope at all. A suggestion that can name the agent you have
 * open is the smallest visible proof that the copilot knows more than the
 * page title.
 */
export type AppSection =
  | "today"
  | "agents-index"
  | "agent-build"
  | "agent-runs"
  | "agent-trace"
  | "agent-versions"
  | "flows"
  | "insights"
  | "knowledge"
  | "settings"
  | "workspace";

/**
 * Routes in this app are all `/w/{workspace}/…`; everything meaningful is
 * in the segments after the slug. Matching on segment *shape* rather than a
 * regex per route keeps this readable as the route table grows, and means
 * an unrecognized route degrades to the workspace-level suggestions instead
 * of producing none.
 */
export function sectionForRoute(route: string): AppSection {
  const segments = route.split("/").filter(Boolean);
  if (segments[0] !== "w" || segments.length < 3) return "workspace";
  const [, , section, , leaf, deepLeaf] = segments;

  switch (section) {
    case "today":
      return "today";
    case "flows":
      return "flows";
    case "insights":
      return "insights";
    case "knowledge":
      return "knowledge";
    case "settings":
      return "settings";
    case "agents":
      if (segments.length === 3) return "agents-index";
      if (leaf === "build") return "agent-build";
      if (leaf === "versions") return "agent-versions";
      if (leaf === "runs") return deepLeaf ? "agent-trace" : "agent-runs";
      return "agents-index";
    default:
      return "workspace";
  }
}

const SUGGESTIONS: Record<AppSection, (subject: string) => string[]> = {
  today: () => [
    "What needs my attention first this morning?",
    "Which agents failed in the last 24 hours, and why?",
    "Summarize what changed across my clients since yesterday.",
  ],
  "agents-index": () => [
    "Which agent costs the most per run right now?",
    "Which of these agents haven't run in the last week?",
    "Compare success rates across all published agents.",
  ],
  "agent-build": (subject) => [
    `Explain what ${subject} does, step by step.`,
    `What would break if I published ${subject} right now?`,
    "Suggest a cheaper model for this graph without losing quality.",
  ],
  "agent-runs": (subject) => [
    `Why has ${subject} been failing?`,
    "Show me the slowest runs and what made them slow.",
    "What's the cost trend for this agent over the last 30 days?",
  ],
  "agent-trace": (subject) => [
    "Which step in this run took the longest, and why?",
    `Explain why ${subject} produced this output.`,
    "Compare this run to the last successful one.",
  ],
  "agent-versions": (subject) => [
    `What changed between the last two versions of ${subject}?`,
    "Which version has the best success rate?",
    "Summarize the publish history for this agent.",
  ],
  flows: () => [
    "What automations would save my team the most time?",
    "Which manual steps show up most often in my agents?",
    "Draft a flow that files new client intake into the CRM.",
  ],
  insights: () => [
    "Where is my agent spend actually going?",
    "Which client generates the most automation volume?",
    "What's my week-over-week run success rate?",
  ],
  knowledge: () => [
    "What sources are my agents actually retrieving from?",
    "Which knowledge sources haven't been used in a month?",
    "Summarize what's in this knowledge base.",
  ],
  settings: () => [
    "Who has access to this workspace, and at what role?",
    "What changed in this workspace's settings recently?",
    "Explain what each role can and can't do here.",
  ],
  workspace: (subject) => [
    `What's the state of ${subject} right now?`,
    "Which agents need attention today?",
    "Summarize this week's automation activity.",
  ],
};

/** Only the agent-scoped sections interpolate a subject at all, so the
 *  fallback is per-section rather than one generic word that reads wrong on
 *  half of them. In practice `entityLabel` is always set — the provider
 *  contributes the workspace as a baseline entity on every route — so this
 *  is a guard, not the common path. */
const FALLBACK_SUBJECT: Record<AppSection, string> = {
  today: "today",
  "agents-index": "these agents",
  "agent-build": "this agent",
  "agent-runs": "this agent",
  "agent-trace": "this agent",
  "agent-versions": "this agent",
  flows: "these flows",
  insights: "this workspace",
  knowledge: "this knowledge base",
  settings: "this workspace",
  workspace: "this workspace",
};

/** Exactly three, always — the empty state's layout is built for three, and
 *  "as many as we happen to have" is how an empty state stops looking
 *  designed. */
export function suggestedPrompts(envelope: CopilotContext, entityLabel: string | null): string[] {
  const section = sectionForRoute(envelope.route);
  return SUGGESTIONS[section](entityLabel ?? FALLBACK_SUBJECT[section]);
}
