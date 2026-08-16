"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { getUndoStackSnapshot, subscribeToUndoStack } from "@/lib/undo/store";
import {
  EMPTY_ENVELOPE,
  RECENT_ACTIONS_LIMIT,
  buildEnvelope,
  deriveChips,
  restorableChips,
  type ContextChip,
  type ContextContribution,
  type ContextFieldKey,
  type CopilotContext,
  type RecentAction,
} from "./envelope";

/**
 * The context registry is a module-level external store read through
 * `useSyncExternalStore`, not React state held by `CopilotProvider` — the
 * same shape as `lib/undo/store.ts`, the toast queue, and the command
 * palette registry.
 *
 * This is deliberate and load-bearing, not stylistic. `CopilotProvider`
 * wraps every page in the shell, so holding contributions in its own state
 * would re-render the entire page subtree — including the agent canvas —
 * every time a selection changed. B1's canvas-store/graph-store split and
 * B5's replay-store exist to make exactly that class of coupling
 * structurally impossible; a registry that re-rendered the canvas on every
 * run-row click would reintroduce it one level higher up.
 *
 * The store caches its derived envelope and chips: `useSyncExternalStore`
 * requires a referentially stable snapshot, and rebuilding on write (rather
 * than on read) means the merge in `buildEnvelope` runs once per change
 * instead of once per subscriber per render.
 */
interface CopilotSnapshot {
  route: string;
  envelope: CopilotContext;
  chips: ContextChip[];
  restorable: ContextChip[];
  excluded: ContextFieldKey[];
  /** The human-readable name behind `envelope.entity.id`. Carried on the
   *  snapshot rather than in the envelope itself because the envelope's
   *  shape is fixed by the spec (and asserted by gate item 1) — but the
   *  suggested prompts need to be able to say "Recall Scheduler", not a
   *  uuid. */
  entityLabel: string | null;
}

const EMPTY_SNAPSHOT: CopilotSnapshot = {
  route: "",
  envelope: EMPTY_ENVELOPE,
  chips: [],
  restorable: [],
  excluded: [],
  entityLabel: null,
};

let route = "";
/** The provider's own workspace-level contribution. Kept apart from the
 *  registered list rather than registered like everything else because
 *  precedence is positional (last wins) and React runs child effects before
 *  parent ones — a provider-registered baseline would land *after* the page
 *  that just told us it's looking at an agent, and silently overwrite it. */
let baseline: ContextContribution | null = null;
let contributions: ContextContribution[] = [];
let excluded: ContextFieldKey[] = [];
let recentActions: RecentAction[] = [];
let snapshot: CopilotSnapshot = EMPTY_SNAPSHOT;

const listeners = new Set<() => void>();

function activeContributions(): ContextContribution[] {
  return baseline ? [baseline, ...contributions] : contributions;
}

function rebuild(): void {
  const active = activeContributions();
  snapshot = {
    route,
    envelope: buildEnvelope({ route, contributions: active, recentActions, excluded }),
    chips: deriveChips({ contributions: active, recentActions, excluded }),
    restorable: restorableChips({ contributions: active, recentActions, excluded }),
    excluded,
    entityLabel: currentEntityLabel() || null,
  };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): CopilotSnapshot {
  return snapshot;
}

function getServerSnapshot(): CopilotSnapshot {
  return EMPTY_SNAPSHOT;
}

/**
 * Registers (or replaces) one feature's contribution. Returns the cleanup
 * that removes it again — spec item 4's "automatic cleanup on unmount" and
 * gate item 6 both rest entirely on callers running this, which
 * `useCopilotContext` does from an effect teardown.
 */
export function registerContribution(contribution: ContextContribution): () => void {
  contributions = [...contributions.filter((entry) => entry.id !== contribution.id), contribution];
  rebuild();
  return () => {
    contributions = contributions.filter((entry) => entry.id !== contribution.id);
    rebuild();
  };
}

export function setBaselineContribution(next: ContextContribution | null): void {
  baseline = next;
  rebuild();
}

export function setRoute(next: string): void {
  if (route === next) return;
  route = next;
  // Dropped chips reset on navigation: an exclusion is a statement about the
  // context in front of you ("don't send this agent"), and silently carrying
  // it to a different screen would hide context the user never chose to
  // drop there. Within a route it persists, which is what gate item 5 needs.
  excluded = [];
  rebuild();
}

export function excludeField(field: ContextFieldKey): void {
  if (excluded.includes(field)) return;
  excluded = [...excluded, field];
  rebuild();
}

export function restoreField(field: ContextFieldKey): void {
  if (!excluded.includes(field)) return;
  excluded = excluded.filter((entry) => entry !== field);
  rebuild();
}

export function restoreAllFields(): void {
  if (excluded.length === 0) return;
  excluded = [];
  rebuild();
}

/** Test/e2e seam only — resets module state between cases. */
export function resetCopilotContextForTests(): void {
  route = "";
  baseline = null;
  contributions = [];
  excluded = [];
  recentActions = [];
  seenUndoIds.clear();
  undoWatchStarted = false;
  snapshot = EMPTY_SNAPSHOT;
  for (const listener of listeners) listener();
}

const seenUndoIds = new Set<string>();
let undoWatchStarted = false;

function currentEntityLabel(): string {
  for (const contribution of [...activeContributions()].reverse()) {
    if (contribution.entity) return contribution.entity.label;
  }
  return "";
}

/**
 * `recentActions` is sourced from the undo stack's labels, per the spec's
 * own note — they're already human-readable, and anything the user can undo
 * is by definition something they just did.
 *
 * Entries are stamped with the entity that was in context *at the moment
 * they appeared*, not at read time: the undo stack outlives navigation, so
 * resolving the entity lazily would relabel an edit made on one agent with
 * whichever agent happens to be open when the copilot is next asked a
 * question. Watching from module scope (rather than a `useUndoStack()` call
 * in the provider) keeps this off the app shell's render path entirely.
 */
function syncRecentActions(): void {
  let changed = false;
  for (const entry of getUndoStackSnapshot()) {
    if (seenUndoIds.has(entry.id)) continue;
    seenUndoIds.add(entry.id);
    recentActions = [
      { action: entry.label, entity: currentEntityLabel(), at: new Date().toISOString() },
      ...recentActions,
    ].slice(0, RECENT_ACTIONS_LIMIT);
    changed = true;
  }
  if (changed) rebuild();
}

/** Started once from the provider's mount effect and never torn down: the
 *  store is app-lifetime, and a second provider mount (there is only ever
 *  one) would otherwise double-append every action. */
function startUndoWatch(): void {
  if (undoWatchStarted) return;
  undoWatchStarted = true;
  subscribeToUndoStack(syncRecentActions);
  syncRecentActions();
}

export function useCopilotSnapshot(): CopilotSnapshot {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useCopilotEnvelope(): CopilotContext {
  return useCopilotSnapshot().envelope;
}

export interface CopilotWorkspace {
  id: string;
  slug: string;
  name: string;
}

const WorkspaceContext = React.createContext<CopilotWorkspace | null>(null);

export function useCopilotWorkspace(): CopilotWorkspace {
  const workspace = React.useContext(WorkspaceContext);
  if (!workspace) throw new Error("useCopilotWorkspace must be used inside <CopilotProvider>");
  return workspace;
}

export interface CopilotProviderProps {
  workspace: CopilotWorkspace;
  children: React.ReactNode;
}

/**
 * Mounted once, in the app shell, above every page. Owns the three inputs
 * the registry can't get from a feature: the current route, the workspace
 * baseline every screen sits inside, and the undo-stack watch.
 */
export function CopilotProvider({ workspace, children }: CopilotProviderProps) {
  const pathname = usePathname();

  React.useEffect(() => {
    startUndoWatch();
  }, []);

  // Layout effect, not a plain effect: the route must be current before the
  // dock paints, or a navigation briefly shows the previous screen's route
  // in the envelope probe and in any route-derived suggestion.
  React.useLayoutEffect(() => {
    setRoute(pathname);
  }, [pathname]);

  React.useLayoutEffect(() => {
    setBaselineContribution({
      id: "workspace",
      entity: { type: "workspace", id: workspace.id, label: workspace.name },
    });
    return () => setBaselineContribution(null);
  }, [workspace.id, workspace.name]);

  return <WorkspaceContext.Provider value={workspace}>{children}</WorkspaceContext.Provider>;
}

/**
 * Renders the live envelope into the DOM as JSON. Gate item 1 walks every
 * route asserting the envelope's shape, and it has to be able to read the
 * envelope without opening the dock (opening it would change the very thing
 * being measured on some routes, and the dock isn't mounted on a route the
 * user hasn't opened it on).
 *
 * Same class of deliberate, inert test seam as B1's `data-render-count` and
 * B6's `data-version-id`: a hidden element carrying data the app already
 * holds, costing one JSON.stringify per context change.
 */
export function CopilotEnvelopeProbe() {
  const envelope = useCopilotEnvelope();
  return <div hidden data-copilot-envelope={JSON.stringify(envelope)} />;
}
