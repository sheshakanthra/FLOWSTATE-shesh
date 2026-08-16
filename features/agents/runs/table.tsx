"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, History } from "lucide-react";
import { DataTable, type ColumnDef, type RowSelectionState } from "@/components/patterns/data-table";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { RunDetailRecord, RunStatus } from "@/lib/repos/runs";
import { useCopilotContext } from "@/features/copilot/context/use-copilot-context";
import { formatTimestamp } from "../lib/format";
import {
  DEFAULT_RUNS_FILTER,
  RunsFilters,
  datePresetLabel,
  datePresetToRange,
  matchesRunsFilter,
  type RunsFilterState,
} from "./filters";

const STATUS_BADGE: Record<RunStatus, { label: string; variant: BadgeVariant }> = {
  running: { label: "Running", variant: "blue" },
  succeeded: { label: "Succeeded", variant: "emerald" },
  failed: { label: "Failed", variant: "red" },
  cancelled: { label: "Cancelled", variant: "neutral" },
};

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}
function formatCost(usd: number | null): string {
  if (usd === null) return "—";
  return `$${usd.toFixed(4)}`;
}
function formatTokens(inputTokens: number | null, outputTokens: number | null): string {
  if (inputTokens === null && outputTokens === null) return "—";
  return `${inputTokens ?? 0} in / ${outputTokens ?? 0} out`;
}

export interface RunsTableProps {
  runs: RunDetailRecord[];
  agentId: string;
  agentName: string;
  workspaceSlug: string;
}

/**
 * Session spec item 1: `DataTable` (A5) with status/trigger/duration/token
 * count/cost/timestamp, filterable by status and date, virtualized -- the
 * last part is `DataTable`'s own baseline behavior (`@tanstack/react-virtual`
 * under the hood), not something this file adds. Owns filter state itself
 * rather than being a pure presentational wrapper, since `runs/page.tsx`
 * (a Server Component) can't hold interactive state -- matching B3's
 * `AgentBuilder` precedent for "the client wiring a spec's file list
 * doesn't separately name, but which has to live somewhere."
 */
export function RunsTable({ runs, agentId, agentName, workspaceSlug }: RunsTableProps) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<RunsFilterState>(DEFAULT_RUNS_FILTER);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const filtered = React.useMemo(() => runs.filter((run) => matchesRunsFilter(run, filter)), [runs, filter]);

  const selectedRunIds = React.useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection],
  );

  // Resolved once per preset change, not per render: `datePresetToRange`
  // closes over `new Date()`, so recomputing it inline would hand the
  // registry a structurally different contribution on every render and
  // re-register the whole screen's context for no reason. Pinning it to the
  // moment the preset was chosen is also the more truthful value.
  const dateRange = React.useMemo(() => {
    const range = datePresetToRange(filter.datePreset);
    return range ? { ...range, label: datePresetLabel(filter.datePreset) } : undefined;
  }, [filter.datePreset]);

  // C1 item 4: Track B's run context. The whole screen is described, not
  // just the agent -- which statuses are being looked at, over what window,
  // and which specific runs are selected. `dateRange` is resolved to real
  // timestamps rather than passed as the preset name, so the copilot never
  // has to know what "7d" means (see filters.tsx's own note).
  useCopilotContext({
    id: "agent-runs",
    entity: { type: "agent", id: agentId, label: agentName },
    selection: { type: "run", ids: selectedRunIds },
    filters: filter.statuses.size > 0 ? { status: [...filter.statuses] } : undefined,
    dateRange,
  });

  const goToTrace = React.useCallback(
    (runId: string) => router.push(`/w/${workspaceSlug}/agents/${agentId}/runs/${runId}`),
    [router, workspaceSlug, agentId],
  );

  const columns = React.useMemo<ColumnDef<RunDetailRecord>[]>(
    () => [
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        size: 110,
        cell: ({ row }) => {
          const badge = STATUS_BADGE[row.original.status];
          return <Badge variant={badge.variant}>{badge.label}</Badge>;
        },
      },
      { id: "trigger", header: "Trigger", accessorKey: "trigger", size: 100 },
      {
        id: "duration",
        header: "Duration",
        accessorFn: (row) => row.durationMs ?? -1,
        size: 90,
        cell: ({ row }) => formatDuration(row.original.durationMs),
      },
      {
        id: "tokens",
        header: "Tokens",
        accessorFn: (row) => (row.inputTokens ?? 0) + (row.outputTokens ?? 0),
        size: 150,
        cell: ({ row }) => formatTokens(row.original.inputTokens, row.original.outputTokens),
      },
      {
        id: "cost",
        header: "Cost",
        accessorKey: "costUsd",
        size: 90,
        cell: ({ row }) => formatCost(row.original.costUsd),
      },
      {
        id: "startedAt",
        header: "Started",
        accessorFn: (row) => row.startedAt.getTime(),
        size: 190,
        cell: ({ row }) => formatTimestamp(row.original.startedAt),
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      <RunsFilters value={filter} onChange={setFilter} />
      <DataTable
        data={filtered}
        columns={columns}
        getRowId={(row) => row.id}
        aria-label="Run history"
        // Selection is on as of C1: selecting runs is how this screen
        // contributes a `selection` to the copilot's context envelope
        // (gate item 2). B5 had no consumer for it and left it off.
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        onRowAction={(row) => goToTrace(row.id)}
        renderRowActions={(row) => (
          <Button variant="ghost" size="icon" aria-label="View trace" onClick={() => goToTrace(row.id)}>
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        )}
        emptyState={
          <EmptyState
            icon={History}
            title="No runs match these filters"
            description="Try a broader status or date range."
            action={{ label: "Clear filters", onClick: () => setFilter(DEFAULT_RUNS_FILTER) }}
          />
        }
      />
    </div>
  );
}
