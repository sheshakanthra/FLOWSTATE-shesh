# C3 — Tool registry, action previews, approval

**Track:** C · Copilot
**Preconditions:** C2 gate passed

## Objective

The copilot acts, not just answers — and never silently.

## Scope

1. **Tool registry.** Each tool declares: name, description, Zod input schema, required permission, executor, and a preview renderer. Adding a tool means adding one file.
2. **Tools for this slice** (six, matching what exists):
   - `create_agent_from_description` — generates a graph, previews it as a rendered canvas
   - `explain_run` — analyzes a failed run and explains the failure
   - `modify_agent` — proposes graph changes, previews as a canvas diff
   - `summarize_activity` — workspace summary over a date range
   - `search_runs` — structured query over run history, previews as a table
   - `draft_message` — client-facing update, previews as formatted text
3. **The approval rule.** No tool that mutates anything executes without explicit user approval. The copilot proposes; the user approves. Read-only tools (`explain_run`, `summarize_activity`, `search_runs`) execute directly.
4. **Action preview** — a card that slides up from the composer with a spectral hairline on top, showing exactly what will change. For `modify_agent`, a real canvas diff with added/removed/modified highlighting — not a JSON blob.
5. **Permission enforcement.** Tools check the caller's role server-side. A Member's copilot cannot perform an Owner-only action, and the failure message says which permission is missing.
6. **Tool call rendering** — a card that shimmers while executing, shows the result on completion, and shows the error with a retry on failure. Registered with the `FiringBar`.
7. **Undo.** Every approved mutating action registers an inverse. `⌘Z` undoes a copilot action exactly like a manual one.
8. **Prompt library** — saved prompts, workspace-shared, insertable with `/`.

## Out of scope

No autonomous multi-step chains. No background tasks. No tools for features that don't exist in this slice.

## Files

```
features/copilot/tools/{registry.ts,types.ts}
features/copilot/tools/definitions/{create-agent,explain-run,modify-agent,summarize-activity,search-runs,draft-message}.ts
features/copilot/tools/previews/{graph-preview.tsx,diff-preview.tsx,table-preview.tsx,text-preview.tsx}
features/copilot/actions/{approval-card.tsx,execute.ts}
features/copilot/prompt-library/{index.tsx,store.ts}
app/api/copilot/execute/route.ts
```

## Gate

1. "Build me an agent that qualifies inbound leads" produces a previewed graph; approving creates a real, runnable agent.
2. No mutating tool executes without approval — verified by a test that calls the stream endpoint with a mutating tool and asserts nothing changed in the DB.
3. `modify_agent` preview shows a genuine canvas diff, not serialized JSON.
4. Permission test: a Member attempts an Owner-only tool via direct API call and is rejected server-side with the missing permission named.
5. `⌘Z` undoes an approved copilot action.
6. Tool calls appear in the `FiringBar` while executing.
7. A failing tool shows a specific error and a working retry.
8. Prompt library: `/` opens it, selection inserts the prompt, saving a new prompt persists workspace-wide.
9. Approval cards are keyboard operable and their accessible name describes the consequence, not just "Approve."

## Notes

`create_agent_from_description` is the demo moment for this track — the same capability as the marketing hero, but inside the product with real context. Reuse the generation logic; E1 will import it.

Preview quality is the whole trust mechanism. A JSON diff makes users click approve without reading. A canvas diff makes them actually check.
