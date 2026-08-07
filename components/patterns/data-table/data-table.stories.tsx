import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fireEvent, userEvent, waitFor, within } from "@storybook/test";
import { Archive, Bot, MoreHorizontal, Trash2 } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { BulkActionBar } from "../bulk-action-bar";
import { DataTable } from "./data-table";
import type { ColumnDef, RowSelectionState } from "./types";

interface AgentRow {
  id: string;
  name: string;
  status: "healthy" | "at-risk" | "failed";
  runs: number;
  lastRun: string;
}

const STATUS_VARIANT: Record<AgentRow["status"], BadgeVariant> = {
  healthy: "emerald",
  "at-risk": "amber",
  failed: "red",
};

function makeRows(count: number): AgentRow[] {
  const statuses: AgentRow["status"][] = ["healthy", "at-risk", "failed"];
  return Array.from({ length: count }, (_, index) => {
    const status = statuses[index % statuses.length] as AgentRow["status"];
    return {
      id: `agent-${index}`,
      name: `Agent ${index + 1}`,
      status,
      runs: (index * 37) % 999,
      lastRun: `${(index % 23) + 1}h ago`,
    };
  });
}

const columns: ColumnDef<AgentRow>[] = [
  { accessorKey: "name", header: "Name", size: 240 },
  {
    accessorKey: "status",
    header: "Status",
    size: 140,
    cell: ({ getValue }) => {
      const status = getValue<AgentRow["status"]>();
      return <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>;
    },
  },
  { accessorKey: "runs", header: "Runs", size: 100 },
  { accessorKey: "lastRun", header: "Last run", size: 140 },
];

const meta: Meta = {
  title: "Patterns/DataTable",
};

export default meta;
type Story = StoryObj;

const SMALL_ROWS = makeRows(6);

export const Default: Story = {
  render: () => (
    <DataTable aria-label="Agents" data={SMALL_ROWS} columns={columns} getRowId={(row) => row.id} height={320} />
  ),
};

export const WithSelection: Story = {
  render: function Render() {
    const [selection, setSelection] = useState<RowSelectionState>({});
    const count = Object.values(selection).filter(Boolean).length;
    return (
      <div className="flex flex-col gap-3">
        <DataTable
          aria-label="Agents"
          data={SMALL_ROWS}
          columns={columns}
          getRowId={(row) => row.id}
          rowSelection={selection}
          onRowSelectionChange={setSelection}
          height={320}
        />
        <BulkActionBar
          count={count}
          itemLabel="agent"
          onClear={() => setSelection({})}
          actions={[
            { label: "Archive", icon: Archive, onClick: () => {} },
            { label: "Delete", icon: Trash2, variant: "danger", onClick: () => setSelection({}) },
          ]}
        />
      </div>
    );
  },
};

export const RowActions: Story = {
  render: () => (
    <DataTable
      aria-label="Agents"
      data={SMALL_ROWS}
      columns={columns}
      getRowId={(row) => row.id}
      height={320}
      onRowAction={() => {}}
      renderRowActions={() => (
        <button
          type="button"
          aria-label="More actions"
          className="flex size-7 items-center justify-center rounded-sm text-fg-200 hover:bg-ink-200 hover:text-fg-000"
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </button>
      )}
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <DataTable
      aria-label="Agents"
      data={[]}
      columns={columns}
      getRowId={(row) => row.id}
      height={320}
      emptyState={
        <EmptyState
          icon={Bot}
          title="No agents yet"
          description="Build your first agent to start automating a workflow."
          action={{ label: "New agent", onClick: () => {} }}
        />
      }
    />
  ),
};

export const Loading: Story = {
  render: () => (
    <DataTable aria-label="Agents" data={[]} columns={columns} getRowId={(row) => row.id} height={320} isLoading />
  ),
};

const LARGE_ROWS = makeRows(50_000);

export const FiftyThousandRows: Story = {
  name: "50,000 rows",
  render: () => (
    <DataTable aria-label="Agents" data={LARGE_ROWS} columns={columns} getRowId={(row) => row.id} height={480} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const grid = canvas.getByRole("grid", { name: "Agents" });
    await waitFor(() => expect(within(grid).getAllByRole("row").length).toBeGreaterThan(1));

    // Gate item 1: whatever the row count, only the visible (+ overscan) rows are ever mounted.
    const renderedRows = within(grid)
      .getAllByRole("row")
      .filter((el) => el.getAttribute("data-index") !== null);
    expect(renderedRows.length).toBeLessThan(60);
  },
};

export const KeyboardAndSelection: Story = {
  render: function Render() {
    const [selection, setSelection] = useState<RowSelectionState>({});
    return (
      <DataTable
        aria-label="Agents"
        data={SMALL_ROWS}
        columns={columns}
        getRowId={(row) => row.id}
        rowSelection={selection}
        onRowSelectionChange={setSelection}
        height={320}
        onRowAction={() => {}}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const grid = canvas.getByRole("grid", { name: "Agents" });
    grid.focus();

    await userEvent.keyboard("jj ");
    await waitFor(() => {
      const rows = within(grid)
        .getAllByRole("row")
        .filter((el) => el.getAttribute("data-index") !== null);
      expect(rows.filter((el) => el.getAttribute("aria-selected") === "true")).toHaveLength(1);
    });

    await userEvent.keyboard("{Meta>}a{/Meta}");
    await waitFor(() => {
      const rows = within(grid)
        .getAllByRole("row")
        .filter((el) => el.getAttribute("data-index") !== null);
      expect(rows.filter((el) => el.getAttribute("aria-selected") === "true")).toHaveLength(SMALL_ROWS.length);
    });
  },
};

export const ShiftRangeSelect: Story = {
  render: function Render() {
    const [selection, setSelection] = useState<RowSelectionState>({});
    return (
      <DataTable
        aria-label="Agents"
        data={SMALL_ROWS}
        columns={columns}
        getRowId={(row) => row.id}
        rowSelection={selection}
        onRowSelectionChange={setSelection}
        height={320}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const grid = canvas.getByRole("grid", { name: "Agents" });
    const rows = () =>
      within(grid)
        .getAllByRole("row")
        .filter((el) => el.getAttribute("data-index") !== null);

    const first = rows()[0];
    if (!first) throw new Error("expected at least one row");
    await userEvent.click(first);
    await waitFor(() => expect(first).toHaveAttribute("aria-selected", "true"));

    const third = rows()[2];
    if (!third) throw new Error("expected at least three rows");
    fireEvent.click(third, { shiftKey: true });

    await waitFor(() => {
      const selected = rows().filter((el) => el.getAttribute("aria-selected") === "true");
      expect(selected).toHaveLength(3);
    });
  },
};
