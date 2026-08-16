"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, MoreHorizontal, Power, PowerOff } from "lucide-react";
import { DataTable, type ColumnDef, type RowSelectionState } from "@/components/patterns/data-table";
import { BulkActionBar } from "@/components/patterns/bulk-action-bar";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { useCopilotContext } from "@/features/copilot/context/use-copilot-context";
import { exportAgent, serializeAgentExport } from "../lib/export";
import { formatTimestamp } from "../lib/format";
import type { AgentStatus } from "@/lib/repos/agents";

export interface AgentIndexTableRow {
  id: string;
  name: string;
  status: AgentStatus;
  enabled: boolean;
  latestVersion: number | null;
  lastRunStatus: "running" | "succeeded" | "failed" | "cancelled" | null;
  lastRunAt: string | null;
  successRate: number | null;
  costLast7DaysUsd: number;
  ownerName: string | null;
}

const STATUS_BADGE: Record<AgentStatus, BadgeVariant> = {
  draft: "blue",
  published: "emerald",
  failing: "red",
  archived: "neutral",
};

const RUN_STATUS_BADGE: Record<NonNullable<AgentIndexTableRow["lastRunStatus"]>, BadgeVariant> = {
  running: "blue",
  succeeded: "emerald",
  failed: "red",
  cancelled: "neutral",
};

function downloadJson(filename: string, content: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export interface AgentsTableProps {
  agents: AgentIndexTableRow[];
  workspaceSlug: string;
}

/**
 * Session spec item 8: the agents index rebuilt as a real `DataTable`
 * (virtualized -- A5's own baseline, not something this file adds) with
 * name/status/version/last run/success rate/cost-last-7-days/owner, row
 * actions, and bulk enable/disable. `enabled` also gets a per-row `Switch`
 * (not just the bulk action) -- both go through the same
 * `PATCH /api/agents` endpoint with a one- or many-element `agentIds`
 * array, so there's no second code path to keep in sync.
 */
export function AgentsTable({ agents, workspaceSlug }: AgentsTableProps) {
  const router = useRouter();
  const [rows, setRows] = React.useState(agents);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set());

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);

  // C1 item 4: no single entity on an index page, but a multi-row selection
  // is real context -- "compare these three agents" only means anything if
  // the copilot knows which three.
  useCopilotContext({ id: "agents-index", selection: { type: "agent", ids: selectedIds } });

  async function setEnabled(agentIds: string[], enabled: boolean) {
    setPendingIds((prev) => new Set([...prev, ...agentIds]));
    try {
      const response = await fetch("/api/agents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug, agentIds, enabled }),
      });
      if (!response.ok) {
        toast({ title: "Couldn't update", description: "Try again in a moment.", variant: "danger" });
        return;
      }
      setRows((current) => current.map((row) => (agentIds.includes(row.id) ? { ...row, enabled } : row)));
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        for (const id of agentIds) next.delete(id);
        return next;
      });
    }
  }

  async function handleDuplicate(agentId: string) {
    const response = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "duplicate", workspaceSlug, agentId }),
    });
    if (!response.ok) {
      toast({ title: "Couldn't duplicate", description: "Try again in a moment.", variant: "danger" });
      return;
    }
    const data = (await response.json()) as { agent: { id: string; name: string } };
    toast({ title: "Duplicated", description: `Created "${data.agent.name}".` });
    router.refresh();
  }

  async function handleExport(agentId: string) {
    const response = await fetch(`/api/agents/${agentId}?workspaceSlug=${encodeURIComponent(workspaceSlug)}`);
    if (!response.ok) {
      toast({ title: "Couldn't export", description: "Try again in a moment.", variant: "danger" });
      return;
    }
    const data = (await response.json()) as { agent: { name: string; description: string | null; graph: unknown } };
    const exported = exportAgent({
      name: data.agent.name,
      description: data.agent.description,
      graph: data.agent.graph as never,
    });
    const filename = `${data.agent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.kiln-agent.json`;
    downloadJson(filename, serializeAgentExport(exported));
  }

  const columns = React.useMemo<ColumnDef<AgentIndexTableRow>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessorKey: "name",
        size: 220,
        cell: ({ row }) => <span className="truncate font-medium text-fg-000">{row.original.name}</span>,
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        size: 100,
        cell: ({ row }) => <Badge variant={STATUS_BADGE[row.original.status]}>{row.original.status}</Badge>,
      },
      {
        id: "enabled",
        header: "Enabled",
        accessorKey: "enabled",
        size: 90,
        enableSorting: false,
        cell: ({ row }) => (
          <Switch
            checked={row.original.enabled}
            disabled={pendingIds.has(row.original.id)}
            onCheckedChange={(checked) => setEnabled([row.original.id], checked)}
            onClick={(event) => event.stopPropagation()}
            aria-label={`${row.original.enabled ? "Disable" : "Enable"} ${row.original.name}`}
          />
        ),
      },
      {
        id: "version",
        header: "Version",
        accessorFn: (row) => row.latestVersion ?? -1,
        size: 90,
        cell: ({ row }) => (row.original.latestVersion !== null ? `v${row.original.latestVersion}` : "—"),
      },
      {
        id: "lastRun",
        header: "Last run",
        accessorFn: (row) => (row.lastRunAt ? new Date(row.lastRunAt).getTime() : -1),
        size: 200,
        cell: ({ row }) => {
          if (!row.original.lastRunAt || !row.original.lastRunStatus) {
            return <span className="text-fg-200">Never run</span>;
          }
          return (
            <span className="flex items-center gap-1.5">
              <Badge variant={RUN_STATUS_BADGE[row.original.lastRunStatus]}>{row.original.lastRunStatus}</Badge>
              <span className="text-meta text-fg-200">{formatTimestamp(new Date(row.original.lastRunAt))}</span>
            </span>
          );
        },
      },
      {
        id: "successRate",
        header: "Success rate",
        accessorFn: (row) => row.successRate ?? -1,
        size: 110,
        cell: ({ row }) =>
          row.original.successRate !== null ? `${Math.round(row.original.successRate * 100)}%` : "—",
      },
      {
        id: "cost7d",
        header: "Cost (7d)",
        accessorKey: "costLast7DaysUsd",
        size: 100,
        cell: ({ row }) => `$${row.original.costLast7DaysUsd.toFixed(2)}`,
      },
      {
        id: "owner",
        header: "Owner",
        accessorFn: (row) => row.ownerName ?? "",
        size: 140,
        cell: ({ row }) => row.original.ownerName ?? "—",
      },
    ],
    [pendingIds],
  );

  return (
    <div className="relative flex flex-col gap-4">
      <DataTable
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        aria-label="Agents"
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        onRowAction={(row) => router.push(`/w/${workspaceSlug}/agents/${row.id}/build`)}
        renderRowActions={(row) => (
          // A single trigger, not two adjacent icon buttons -- `DataTable`'s
          // own `__actions` column is a fixed 48px (sized for exactly one
          // affordance, matching B5's `RunsTable` precedent), which a pair
          // of full-size icon buttons doesn't fit inside; the overflow was
          // getting silently clipped by the cell's own `truncate`, leaving
          // the second button visually present but unclickable at its
          // apparent position. A kebab menu is also the more standard
          // pattern once a row has more than one action anyway.
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Actions for ${row.name}`}>
                <MoreHorizontal className="size-3.5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleDuplicate(row.id)}>
                <Copy className="size-3.5" aria-hidden="true" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport(row.id)}>
                <Download className="size-3.5" aria-hidden="true" />
                Export
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <div className="pointer-events-none sticky bottom-4 flex justify-center">
        <div className="pointer-events-auto">
          <BulkActionBar
            count={selectedIds.length}
            itemLabel="agent"
            onClear={() => setRowSelection({})}
            actions={[
              {
                label: "Enable",
                icon: Power,
                onClick: () => setEnabled(selectedIds, true),
              },
              {
                label: "Disable",
                icon: PowerOff,
                variant: "danger",
                onClick: () => setEnabled(selectedIds, false),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
