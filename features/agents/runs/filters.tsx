"use client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RunStatus } from "@/lib/repos/runs";

export type DatePreset = "all" | "today" | "7d" | "30d";

export interface RunsFilterState {
  /** Empty set = every status. */
  statuses: Set<RunStatus>;
  datePreset: DatePreset;
}

export const DEFAULT_RUNS_FILTER: RunsFilterState = { statuses: new Set(), datePreset: "all" };

const STATUS_OPTIONS: { value: RunStatus; label: string }[] = [
  { value: "running", label: "Running" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  all: "All time",
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

export interface RunsFiltersProps {
  value: RunsFilterState;
  onChange: (value: RunsFilterState) => void;
}

/**
 * Status is a toggle-button group (not a dropdown) -- with only four
 * values, exposing them all at once is fewer clicks than a menu, and each
 * button's `aria-pressed` state is directly, natively keyboard-operable.
 * Date is a preset Select rather than a from/to range picker: no calendar
 * primitive exists in this codebase's approved stack (components/ui has no
 * Radix date picker, and CLAUDE.md names no calendar dependency to add),
 * and "filterable by ... date" is satisfied by coarse, common buckets
 * without inventing a new primitive category this session doesn't own.
 */
export function RunsFilters({ value, onChange }: RunsFiltersProps) {
  function toggleStatus(status: RunStatus) {
    const next = new Set(value.statuses);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    onChange({ ...value, statuses: next });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5" role="group" aria-label="Filter by status">
        {STATUS_OPTIONS.map((option) => {
          const active = value.statuses.has(option.value);
          return (
            <Button
              key={option.value}
              variant={active ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={active}
              onClick={() => toggleStatus(option.value)}
            >
              {option.label}
            </Button>
          );
        })}
      </div>

      <Select value={value.datePreset} onValueChange={(datePreset: DatePreset) => onChange({ ...value, datePreset })}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map((preset) => (
            <SelectItem key={preset} value={preset}>
              {DATE_PRESET_LABELS[preset]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function datePresetLabel(preset: DatePreset): string {
  return DATE_PRESET_LABELS[preset];
}

/**
 * The copilot's context envelope (C1) carries `dateRange` as a concrete
 * `{from, to}` pair, not a preset name — a copilot that has to know what
 * "7d" means is back to receiving app jargon instead of context. Resolving
 * the preset here keeps that translation next to the presets themselves.
 * `all` has no range, which is why this returns null rather than an
 * artificially wide window.
 */
export function datePresetToRange(preset: DatePreset, now: Date = new Date()): { from: string; to: string } | null {
  if (preset === "all") return null;
  const to = now.toISOString();
  if (preset === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { from: start.toISOString(), to };
  }
  const days = preset === "7d" ? 7 : 30;
  return { from: new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString(), to };
}

export function matchesRunsFilter(
  run: { status: RunStatus; startedAt: Date },
  filter: RunsFilterState,
  now: Date = new Date(),
): boolean {
  if (filter.statuses.size > 0 && !filter.statuses.has(run.status)) return false;

  if (filter.datePreset === "all") return true;
  const ms = now.getTime() - run.startedAt.getTime();
  if (filter.datePreset === "today") {
    return (
      run.startedAt.getFullYear() === now.getFullYear() &&
      run.startedAt.getMonth() === now.getMonth() &&
      run.startedAt.getDate() === now.getDate()
    );
  }
  if (filter.datePreset === "7d") return ms <= 7 * 24 * 60 * 60 * 1000;
  if (filter.datePreset === "30d") return ms <= 30 * 24 * 60 * 60 * 1000;
  return true;
}
