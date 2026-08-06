"use client";

import * as React from "react";
import {
  type SortingState,
  type Table as TableInstance,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { SkeletonRow } from "@/components/ui/skeleton";
import type { ColumnDef, DataTableProps, RowSelectionState } from "./types";

function SortIcon({ direction }: { direction: false | "asc" | "desc" }) {
  if (direction === "asc") return <ArrowUp className="size-3.5" aria-hidden="true" />;
  if (direction === "desc") return <ArrowDown className="size-3.5" aria-hidden="true" />;
  return <ChevronsUpDown className="size-3.5 text-fg-300" aria-hidden="true" />;
}

/**
 * TanStack Table v8 (state, sorting, column sizing) + @tanstack/react-virtual
 * (only rendered rows are ever in the DOM, however large `data` is).
 * Selection is layered on top of TanStack's own `rowSelection` state rather
 * than using its default click handler, because click/⌘-click/shift-range
 * semantics aren't something the library provides — `tableRef` lets the
 * selection handlers reach the live, sorted/filtered row model without a
 * circular dependency between "build columns" (which need the handlers)
 * and "build the table" (which needs the columns).
 */
export function DataTable<TData>({
  data,
  columns,
  getRowId,
  "aria-label": ariaLabel,
  selectable = true,
  rowSelection: rowSelectionProp,
  onRowSelectionChange,
  onRowAction,
  renderRowActions,
  isLoading = false,
  loadingRowCount = 8,
  emptyState,
  estimatedRowHeight = 40,
  height = 480,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [rowSelectionUncontrolled, setRowSelectionUncontrolled] = React.useState<RowSelectionState>({});
  const rowSelection = rowSelectionProp ?? rowSelectionUncontrolled;

  const setRowSelection = React.useCallback(
    (updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => {
      const next = typeof updater === "function" ? updater(rowSelection) : updater;
      if (rowSelectionProp === undefined) setRowSelectionUncontrolled(next);
      onRowSelectionChange?.(next);
    },
    [rowSelection, rowSelectionProp, onRowSelectionChange],
  );

  const tableRef = React.useRef<TableInstance<TData> | null>(null);
  const lastIndexRef = React.useRef<number | null>(null);

  const selectOnly = React.useCallback(
    (index: number) => {
      const row = tableRef.current?.getRowModel().rows[index];
      if (!row) return;
      setRowSelection({ [row.id]: true });
      lastIndexRef.current = index;
    },
    [setRowSelection],
  );

  const toggleRow = React.useCallback(
    (index: number) => {
      const row = tableRef.current?.getRowModel().rows[index];
      if (!row) return;
      setRowSelection((old) => ({ ...old, [row.id]: !old[row.id] }));
      lastIndexRef.current = index;
    },
    [setRowSelection],
  );

  const selectRange = React.useCallback(
    (index: number, additive: boolean) => {
      if (lastIndexRef.current === null) {
        selectOnly(index);
        return;
      }
      const modelRows = tableRef.current?.getRowModel().rows ?? [];
      const start = Math.min(lastIndexRef.current, index);
      const end = Math.max(lastIndexRef.current, index);
      const ids = modelRows.slice(start, end + 1).map((row) => row.id);
      setRowSelection((old) => {
        const next: RowSelectionState = additive ? { ...old } : {};
        for (const id of ids) next[id] = true;
        return next;
      });
    },
    [selectOnly, setRowSelection],
  );

  const selectAllVisible = React.useCallback(() => {
    const modelRows = tableRef.current?.getRowModel().rows ?? [];
    const next: RowSelectionState = {};
    for (const row of modelRows) next[row.id] = true;
    setRowSelection(next);
  }, [setRowSelection]);

  const handleCheckboxClick = React.useCallback(
    (index: number, event: React.MouseEvent) => {
      event.stopPropagation();
      if (event.shiftKey) selectRange(index, true);
      else toggleRow(index);
    },
    [selectRange, toggleRow],
  );

  const handleRowClick = React.useCallback(
    (index: number, event: React.MouseEvent) => {
      if (!selectable) return;
      if (event.shiftKey) selectRange(index, event.metaKey || event.ctrlKey);
      else if (event.metaKey || event.ctrlKey) toggleRow(index);
      else selectOnly(index);
    },
    [selectable, selectRange, toggleRow, selectOnly],
  );

  const tableColumns = React.useMemo<ColumnDef<TData>[]>(() => {
    const cols: ColumnDef<TData>[] = [];
    if (selectable) {
      cols.push({
        id: "__select",
        size: 40,
        minSize: 40,
        maxSize: 40,
        enableResizing: false,
        enableSorting: false,
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllRowsSelected() ? true : table.getIsSomeRowsSelected() ? "indeterminate" : false}
            onCheckedChange={(value) => table.toggleAllRowsSelected(value === true)}
            onClick={(event) => event.stopPropagation()}
            aria-label="Select all rows"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onClick={(event) => handleCheckboxClick(row.index, event)}
            tabIndex={-1}
            aria-label={`Select row ${row.index + 1}`}
          />
        ),
      });
    }
    cols.push(...columns);
    if (renderRowActions) {
      cols.push({
        id: "__actions",
        size: 48,
        minSize: 48,
        maxSize: 48,
        enableResizing: false,
        enableSorting: false,
        header: () => <span className="sr-only">Row actions</span>,
        cell: ({ row }) => (
          <div onClick={(event) => event.stopPropagation()} className="flex justify-end">
            {renderRowActions(row.original)}
          </div>
        ),
      });
    }
    return cols;
  }, [selectable, columns, renderRowActions, handleCheckboxClick]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    getRowId,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: selectable,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  tableRef.current = table;

  const rows = table.getRowModel().rows;

  const [activeIndex, setActiveIndex] = React.useState(0);
  React.useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 12,
  });

  const gridId = React.useId();

  function moveActive(delta: number) {
    setActiveIndex((current) => {
      const next = Math.min(Math.max(current + delta, 0), rows.length - 1);
      rowVirtualizer.scrollToIndex(next, { align: "auto" });
      return next;
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      selectAllVisible();
      return;
    }
    switch (event.key) {
      case "j":
      case "ArrowDown":
        event.preventDefault();
        moveActive(1);
        break;
      case "k":
      case "ArrowUp":
        event.preventDefault();
        moveActive(-1);
        break;
      case " ":
        event.preventDefault();
        toggleRow(activeIndex);
        break;
      case "Enter": {
        event.preventDefault();
        const row = rows[activeIndex];
        if (row) onRowAction?.(row.original);
        break;
      }
      default:
        break;
    }
  }

  const activeRow = rows[activeIndex];
  const showEmpty = !isLoading && rows.length === 0 && emptyState;

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-md border border-ink-400 bg-ink-100", className)}>
      <div
        ref={scrollRef}
        role="grid"
        aria-label={ariaLabel}
        aria-rowcount={rows.length}
        aria-multiselectable={selectable}
        aria-activedescendant={activeRow ? `${gridId}-row-${activeRow.id}` : undefined}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className={cn("overflow-auto outline-none", focusRing)}
        style={{ height }}
      >
        <div role="rowgroup" className="sticky top-0 z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <div
              key={headerGroup.id}
              role="row"
              className="flex h-row-height items-center border-b border-ink-400 bg-ink-200"
            >
              {headerGroup.headers.map((header) => (
                <div
                  key={header.id}
                  role="columnheader"
                  aria-sort={
                    header.column.getIsSorted() === "asc"
                      ? "ascending"
                      : header.column.getIsSorted() === "desc"
                        ? "descending"
                        : header.column.getCanSort()
                          ? "none"
                          : undefined
                  }
                  style={{ width: header.getSize() }}
                  className="relative flex h-full shrink-0 items-center px-3"
                >
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className={cn(
                        "flex items-center gap-1 rounded-sm text-meta font-medium text-fg-100",
                        "transition-instant transition-colors hover:text-fg-000",
                        focusRing,
                      )}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <SortIcon direction={header.column.getIsSorted()} />
                    </button>
                  ) : (
                    <span className="text-meta font-medium text-fg-100">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </span>
                  )}
                  {header.column.getCanResize() ? (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={cn(
                        "absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none",
                        header.column.getIsResizing() ? "bg-blue-fg" : "hover:bg-blue-fg/40",
                      )}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          ))}
        </div>

        {isLoading ? (
          <div role="rowgroup">
            {Array.from({ length: loadingRowCount }, (_, index) => (
              <SkeletonRow key={index} columns={columns.length} selectable={selectable} />
            ))}
          </div>
        ) : showEmpty ? null : (
          <div role="rowgroup" style={{ height: rowVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;
              const isActive = virtualRow.index === activeIndex;
              const isSelected = row.getIsSelected();

              return (
                <div
                  key={row.id}
                  id={`${gridId}-row-${row.id}`}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  role="row"
                  aria-rowindex={virtualRow.index + 1}
                  aria-selected={isSelected}
                  onClick={(event) => handleRowClick(virtualRow.index, event)}
                  onDoubleClick={() => onRowAction?.(row.original)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className={cn(
                    "flex h-row-height cursor-default items-center border-b border-ink-400 text-body text-fg-000",
                    "transition-instant transition-colors",
                    isSelected ? "bg-blue-bg" : isActive ? "bg-ink-200" : "hover:bg-ink-100",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      role="gridcell"
                      style={{ width: cell.column.getSize() }}
                      className="shrink-0 truncate px-3"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {showEmpty ? (
        // Rendered as a sibling of the grid, not inside it — EmptyState's
        // own heading/button aren't valid children of role="grid", and an
        // empty table has nothing to navigate anyway.
        <div className="flex min-h-[240px] items-center justify-center p-section-gap">{emptyState}</div>
      ) : null}
    </div>
  );
}
