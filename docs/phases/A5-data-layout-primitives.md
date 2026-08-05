# A5 — Data & layout primitives

**Track:** A · Foundation
**Preconditions:** A4 gate passed

## Objective

Everything needed to display dense data, plus the resizable layout substrate the builder tracks depend on.

## Scope

1. **`DataTable`** — TanStack Table v8 + virtualization. Column sizing, sorting, multi-select with shift-range, sticky header, row actions, keyboard navigation (`j`/`k`/`Enter`/`space`), and a `BulkActionBar` that appears on selection.
2. `Skeleton` — shape-matched, not generic grey bars. Provide `SkeletonText`, `SkeletonRow`, `SkeletonCard`.
3. `EmptyState` — icon, headline, one sentence of direction, primary action. Never a shrug.
4. `ErrorState` — what happened, what to do next, retry action. Never "Something went wrong."
5. `Progress` (linear + radial), `Stepper`, `Accordion`, `TreeView` (keyboard-navigable, expand/collapse, selection), `Breadcrumb`.
6. `ResizablePanel` and `SplitPane` — drag to resize, min/max constraints, double-click to reset, persisted size per panel id, keyboard resize with arrow keys when the handle is focused.
7. `PageHeader` pattern — title, breadcrumb, description slot, action slot, tab slot.

## Out of scope

No charts (not in this build). No real data. No route integration.

## Files

```
components/ui/{skeleton,empty-state,error-state,progress,stepper,accordion,tree-view,breadcrumb}.tsx
components/ui/{resizable-panel,split-pane}.tsx
components/patterns/{data-table/*,page-header.tsx,bulk-action-bar.tsx}
components/**/*.stories.tsx
```

## Gate

1. `DataTable` story with **50,000 rows**: scroll is smooth at 60fps, and only visible rows are in the DOM (verify in the elements panel).
2. Multi-select: click, `⌘`-click, shift-range all work; selection survives sorting and filtering; `BulkActionBar` shows the correct count.
3. Keyboard: `j`/`k` move the focused row, `space` toggles selection, `Enter` fires the row action, `⌘A` selects all visible.
4. `ResizablePanel` sizes persist across reload; arrow keys resize when the handle has focus.
5. `TreeView` supports arrow-key navigation, `Enter` to select, typeahead to jump.
6. Every empty and error state in Storybook contains a specific next action — a reviewer should not find a single generic message.
7. Both themes, both densities, zero a11y violations.

## Notes

**Stop here and do a design review before starting Track B.** Assemble a throwaway screen combining `PageHeader` + `DataTable` + `Card` + a `Dialog` + the `FiringBar` running. Look at it. If the density feels wrong, the hairlines feel muddy, or the type hierarchy collapses at 14px, fix the tokens now. Fixing them after Track B means touching the canvas, the inspector, and the trace panel.
