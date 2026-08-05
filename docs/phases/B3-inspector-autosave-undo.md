# B3 — Inspector, autosave, undo integration

**Track:** B · Agent Builder
**Preconditions:** B2 gate passed

## Objective

Editing a node's configuration, persisted, fully undoable.

## Scope

1. **Inspector panel** — right-side `ResizablePanel`. Renders a form generated from the selected node's Zod config schema. Sections: identity, configuration, advanced. Empty state when nothing is selected shows agent-level settings instead of a blank panel.
2. Schema-driven form rendering: string → `Input`, enum → `Select`, boolean → `Switch`, number → `Slider` or `Input`, long text → `Textarea`, prompt fields → a `Textarea` with variable autocomplete.
3. **Variable autocomplete** — typing `{{` in any prompt or expression field offers only variables actually in scope at that node, derived from upstream nodes. Not a flat list of everything.
4. Validation on blur; invalid nodes get the `red` border treatment on canvas and the inspector shows the field error.
5. **Persistence.** Graph saved to `agents.graph_jsonb`. Debounced 800ms. Visible save indicator with three states: unsaved, saving, saved-at-timestamp. Registers with the `FiringBar` on save.
6. **Undo integration.** Every graph operation registers an inverse via `useUndoable`: add node, delete node, move node, connect, disconnect, edit property, paste. `⌘Z` covers all of them. Property edits coalesce — typing 12 characters is one undo step, not twelve.
7. Multi-select inspector: when several nodes of the same type are selected, edit shared properties across all of them.

## Out of scope

No execution. No versioning. No templates.

## Files

```
features/agents/inspector/{index.tsx,schema-form.tsx,field-renderers.tsx,variable-autocomplete.tsx,agent-settings.tsx}
features/agents/lib/{scope.ts,persist.ts}
features/agents/store/graph-store.ts   (extend with undo registration)
app/api/agents/[id]/route.ts
lib/repos/agents.ts
```

## Gate

1. Editing a node property updates the canvas summary immediately and persists within 1.5s.
2. Save indicator accurately reflects all three states; killing the network shows an error state with a retry, not a silent failure.
3. `⌘Z` reverses: a node move, a deletion, a connection, and a property edit — each as one step. Typing a 12-character prompt is a single undo.
4. `⌘⇧Z` redoes correctly after each.
5. Variable autocomplete in a node with three upstream nodes offers only those nodes' outputs — verify it does not offer downstream or unconnected variables.
6. Reloading the page restores the graph exactly, including viewport position.
7. Selecting 3 LLM nodes and changing the model updates all three as one undoable action.
8. Inspector is fully keyboard navigable; the panel is resizable by keyboard.

## Notes

Coalescing property-edit undo steps is the detail that makes undo feel correct. A 300ms idle window is a reasonable boundary.

The scope resolver (`lib/scope.ts`) walks upstream from the selected node. It will be reused by the automation builder later if this ever expands — keep it pure and independently testable.
