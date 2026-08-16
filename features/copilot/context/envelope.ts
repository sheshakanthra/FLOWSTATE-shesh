import { z } from "zod";

/**
 * The typed context envelope — session spec item 2. Deliberately pure and
 * framework-free (no React, no Next, no store): every consumer builds an
 * envelope by calling `buildEnvelope` with plain data, so the shape can be
 * unit-tested directly and the gate's "assert the envelope shape" check
 * doesn't need a browser to be meaningful.
 *
 * The spec's framing is the point: this is structured context, not a page
 * name. Nothing here ever collapses to a string.
 */

export type CopilotEntityType = "agent" | "run" | "workspace";

/**
 * The envelope's shape as a runtime validator. Gate item 1 walks every app
 * route in a real browser asserting against this exact schema
 * (e2e/copilot-context.spec.ts), and envelope.test.ts asserts against it
 * too — one definition rather than two that can quietly disagree about what
 * "a valid envelope" means.
 */
export const copilotContextSchema = z.object({
  route: z.string(),
  entity: z.object({
    type: z.enum(["agent", "run", "workspace"]).nullable(),
    id: z.string().nullable(),
  }),
  selection: z.object({ type: z.string(), ids: z.array(z.string()) }).nullable(),
  filters: z.record(z.string(), z.unknown()),
  dateRange: z.object({ from: z.string(), to: z.string() }).nullable(),
  recentActions: z.array(z.object({ action: z.string(), entity: z.string(), at: z.string() })),
});

/** Exactly the shape the session spec names. Do not add fields here without
 *  updating `copilotContextSchema` (envelope.test.ts) and the chip
 *  derivation below — the two are meant to stay in lockstep. */
export interface CopilotContext {
  route: string;
  entity: { type: CopilotEntityType | null; id: string | null };
  selection: { type: string; ids: string[] } | null;
  filters: Record<string, unknown>;
  dateRange: { from: string; to: string } | null;
  recentActions: RecentAction[];
}

export interface RecentAction {
  action: string;
  entity: string;
  at: string;
}

/**
 * The envelope fields a chip can drop (spec item 3 / gate item 5). `route`
 * is deliberately absent: it's the envelope's identity, not a contribution,
 * and an envelope without it isn't "less context," it's malformed.
 */
export type ContextFieldKey = "entity" | "selection" | "filters" | "dateRange" | "recentActions";

export const CONTEXT_FIELD_KEYS: readonly ContextFieldKey[] = [
  "entity",
  "selection",
  "filters",
  "dateRange",
  "recentActions",
];

/**
 * What one feature contributes (spec item 4). A feature registers this via
 * `useCopilotContext()` and it disappears again on unmount — nothing here
 * is stored, so a stale contribution can't outlive the component that knows
 * it's true.
 *
 * `label` on `entity` exists only for the chip; it never reaches the
 * envelope, which carries ids. A chip that said "Agent: 1cca2647-…" would
 * satisfy "context is visible" only in the most literal sense.
 */
export interface ContextContribution {
  /** Stable per contributor, so a re-register replaces rather than stacks. */
  id: string;
  entity?: { type: CopilotEntityType; id: string; label: string };
  selection?: { type: string; ids: string[] };
  filters?: Record<string, unknown>;
  dateRange?: { from: string; to: string; label?: string };
}

export const EMPTY_ENVELOPE: CopilotContext = {
  route: "",
  entity: { type: null, id: null },
  selection: null,
  filters: {},
  dateRange: null,
  recentActions: [],
};

export interface BuildEnvelopeInput {
  route: string;
  contributions: readonly ContextContribution[];
  recentActions: readonly RecentAction[];
  excluded?: readonly ContextFieldKey[];
}

/**
 * Merge rules, chosen for predictability rather than cleverness:
 *
 * - `entity` / `selection` / `dateRange`: last contribution wins. Only one
 *   feature per route contributes each of these in practice, and "last
 *   registered" is at least deterministic when two do — React runs child
 *   effects before parent ones, so the outermost (most page-level)
 *   contributor is the one that lands.
 * - `filters`: shallow-merged across every contribution, since two features
 *   on one screen can each own a genuinely separate filter.
 * - An excluded field is emptied, not omitted — the envelope's shape is
 *   fixed (gate item 1 asserts it on every route), so dropping a chip
 *   removes the *content*, never the key.
 */
export function buildEnvelope({
  route,
  contributions,
  recentActions,
  excluded = [],
}: BuildEnvelopeInput): CopilotContext {
  const isExcluded = (field: ContextFieldKey) => excluded.includes(field);

  let entity: CopilotContext["entity"] = { type: null, id: null };
  let selection: CopilotContext["selection"] = null;
  let dateRange: CopilotContext["dateRange"] = null;
  const filters: Record<string, unknown> = {};

  for (const contribution of contributions) {
    if (contribution.entity) {
      entity = { type: contribution.entity.type, id: contribution.entity.id };
    }
    if (contribution.selection && contribution.selection.ids.length > 0) {
      selection = { type: contribution.selection.type, ids: [...contribution.selection.ids] };
    }
    if (contribution.dateRange) {
      dateRange = { from: contribution.dateRange.from, to: contribution.dateRange.to };
    }
    if (contribution.filters) {
      Object.assign(filters, contribution.filters);
    }
  }

  return {
    route,
    entity: isExcluded("entity") ? { type: null, id: null } : entity,
    selection: isExcluded("selection") ? null : selection,
    filters: isExcluded("filters") ? {} : filters,
    dateRange: isExcluded("dateRange") ? null : dateRange,
    recentActions: isExcluded("recentActions") ? [] : recentActions.slice(0, RECENT_ACTIONS_LIMIT),
  };
}

/** The spec's own cap (Notes): the last 10 undo-stack labels. */
export const RECENT_ACTIONS_LIMIT = 10;

export interface ContextChip {
  field: ContextFieldKey;
  label: string;
}

const ENTITY_TYPE_LABEL: Record<CopilotEntityType, string> = {
  agent: "Agent",
  run: "Run",
  workspace: "Workspace",
};

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * The chips the composer shows (spec item 3). Derived from the same
 * contributions the envelope is built from — not a hand-maintained parallel
 * list — so a chip can never claim context the envelope doesn't carry, or
 * hide context it does.
 *
 * An excluded field produces no chip, which is what makes dropping one
 * visible. `restorableChips` covers the other direction.
 */
export function deriveChips({
  contributions,
  recentActions,
  excluded = [],
}: {
  contributions: readonly ContextContribution[];
  recentActions: readonly RecentAction[];
  excluded?: readonly ContextFieldKey[];
}): ContextChip[] {
  const chips: ContextChip[] = [];
  const present = collectChipLabels(contributions, recentActions);

  for (const field of CONTEXT_FIELD_KEYS) {
    const label = present[field];
    if (label && !excluded.includes(field)) chips.push({ field, label });
  }
  return chips;
}

/** Chips the user has dropped that still have real content behind them —
 *  what the "restore" affordance offers back. A field with no content isn't
 *  restorable, it's just empty. */
export function restorableChips({
  contributions,
  recentActions,
  excluded = [],
}: {
  contributions: readonly ContextContribution[];
  recentActions: readonly RecentAction[];
  excluded?: readonly ContextFieldKey[];
}): ContextChip[] {
  const present = collectChipLabels(contributions, recentActions);
  const chips: ContextChip[] = [];
  for (const field of CONTEXT_FIELD_KEYS) {
    const label = present[field];
    if (label && excluded.includes(field)) chips.push({ field, label });
  }
  return chips;
}

function collectChipLabels(
  contributions: readonly ContextContribution[],
  recentActions: readonly RecentAction[],
): Partial<Record<ContextFieldKey, string>> {
  const labels: Partial<Record<ContextFieldKey, string>> = {};
  const filterKeys: string[] = [];

  for (const contribution of contributions) {
    if (contribution.entity) {
      labels.entity = `${ENTITY_TYPE_LABEL[contribution.entity.type]}: ${contribution.entity.label}`;
    }
    if (contribution.selection && contribution.selection.ids.length > 0) {
      labels.selection = `${pluralize(contribution.selection.ids.length, contribution.selection.type)} selected`;
    }
    if (contribution.dateRange) {
      labels.dateRange =
        contribution.dateRange.label ?? `${contribution.dateRange.from} → ${contribution.dateRange.to}`;
    }
    if (contribution.filters) {
      for (const key of Object.keys(contribution.filters)) {
        if (!filterKeys.includes(key)) filterKeys.push(key);
      }
    }
  }

  if (filterKeys.length > 0) labels.filters = `Filters: ${filterKeys.join(", ")}`;
  if (recentActions.length > 0) {
    labels.recentActions = `${pluralize(Math.min(recentActions.length, RECENT_ACTIONS_LIMIT), "recent action")}`;
  }
  return labels;
}
