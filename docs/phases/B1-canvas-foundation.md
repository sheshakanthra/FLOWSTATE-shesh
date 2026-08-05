# B1 — Agent canvas foundation

**Track:** B · Agent Builder
**Preconditions:** A6 gate passed

## Objective

A canvas that stays at 60fps under load. Performance is architectural here — if it's wrong now, every later session in this track inherits it.

## Scope

1. React Flow 12 (`@xyflow/react`) mounted at `/w/[workspace]/agents/[id]/build`, fully themed with KILN tokens. No default React Flow styling survives.
2. **Two separate stores.** `useCanvasStore` holds viewport transform, selection, and interaction mode. `useGraphStore` holds nodes and edges. Panning must never trigger a graph re-render — this is the single most important decision in the track.
3. Pan, zoom (scroll + `⌘=` / `⌘-` / `⌘0`), fit-to-view, box-select, marquee.
4. `MiniMap`, themed. `Controls`, rebuilt with KILN `Button` — do not ship React Flow's default control bar.
5. Dot grid background using `--ink-050`, scaling with zoom.
6. Node virtualization: nodes outside the viewport unmount above a 100-node threshold.
7. A single placeholder node type (`GenericNode`) so the canvas has something to render. Real node types are B2.
8. Canvas-level context menu: add node, paste, select all, fit view, reset zoom.
9. Empty state for a new agent: a designed prompt to add a trigger, not a blank grid.

## Out of scope

No node types. No ports or connections. No inspector. No persistence beyond in-memory. No running anything.

## Files

```
features/agents/canvas/{index.tsx,background.tsx,minimap.tsx,controls.tsx,context-menu.tsx}
features/agents/store/{canvas-store.ts,graph-store.ts}
features/agents/nodes/generic-node.tsx
features/agents/lib/viewport.ts
app/(app)/w/[workspace]/agents/[id]/build/page.tsx
```

## Gate

1. **Benchmark, committed as a test:** 300 nodes and 400 edges. Pan and zoom continuously for 10 seconds. Frame rate ≥ 55fps at p95, measured in the Performance panel. Record the number in `PROGRESS.md`.
2. React DevTools Profiler: panning the canvas produces **zero** re-renders of node components.
3. Above 100 nodes, off-viewport nodes are absent from the DOM.
4. All keyboard zoom shortcuts work; `⌘0` fits to view.
5. Box-select selects only fully-enclosed nodes; shift-drag adds to selection.
6. Canvas renders correctly in both themes.
7. Empty state gives a specific first action.

## Notes

Do not skip the store split because it seems like premature optimization. React Flow's default pattern couples them, and by B5 you will have a trace scrubber writing to the canvas 60 times a second. Get it right while there is one node type.

Theme React Flow by overriding its CSS variables from our tokens, not by writing new colors. The color-literal lint rule applies here too.
