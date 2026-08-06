import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import type * as React from "react";

export type { ColumnDef, RowSelectionState };

export interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  /** Must be stable across sorts/filters — selection is keyed on this, not row index. */
  getRowId: (row: TData, index: number) => string;
  /** Accessible name for the grid — there's no visible caption otherwise. */
  "aria-label": string;

  selectable?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;

  /** Fired by Enter (keyboard) and double-click (mouse) on a row. */
  onRowAction?: (row: TData) => void;
  /** Trailing per-row actions cell (e.g. an overflow menu). Omit to skip the column entirely. */
  renderRowActions?: (row: TData) => React.ReactNode;

  isLoading?: boolean;
  loadingRowCount?: number;
  emptyState?: React.ReactNode;

  /** Initial guess before react-virtual measures real rendered row heights (which vary by density). */
  estimatedRowHeight?: number;
  /** Height of the scrollable viewport. */
  height?: number | string;

  className?: string;
}
