# B6 — Versioning, publish, templates

**Track:** B · Agent Builder
**Preconditions:** B5 gate passed and the design review is done

## Objective

Close the loop: drafts are safe to edit, published agents are immutable, and starting a new agent isn't a blank canvas.

## Scope

1. **Versioning.** Publishing snapshots the graph into `agent_versions` with an incrementing version number, author, timestamp, and optional note. Published versions are immutable.
2. **Draft isolation.** Editing a published agent edits a draft. A running production agent is unaffected by draft edits — verify this, don't assume it.
3. **Version history panel** — list of versions with author, date, note, and run count. Actions: view (read-only canvas), diff against current, restore as new draft.
4. **Version diff** — visual diff on the canvas: added nodes emerald outline, removed red, modified amber, with a side list of changed properties.
5. **Publish flow** — a dialog showing a pre-publish summary: node count, estimated cost per run, validation results, and any unresolved errors. Publishing is blocked while validation fails, with the failing nodes listed and clickable.
6. **Template gallery** — starting a new agent offers 6 real templates, not placeholders. Each has a name, description, preview thumbnail, and node count. Templates must be genuinely useful agency workflows: e.g. inbound lead qualifier, client status summarizer, meeting-notes-to-tasks, proposal drafter, support triage, weekly report generator.
7. Duplicate an agent. Export/import an agent as JSON.
8. Agents index page (`/agents`) rebuilt properly: `DataTable` with name, status, version, last run, success rate, cost last 7 days, owner. Row actions, bulk enable/disable.

## Out of scope

No marketplace. No sharing across workspaces. No template publishing by users.

## Files

```
features/agents/versions/{panel.tsx,diff.tsx,publish-dialog.tsx,restore.ts}
features/agents/templates/{gallery.tsx,definitions/*.ts}
features/agents/lib/{validate-graph.ts,export.ts,import.ts}
app/(app)/w/[workspace]/agents/page.tsx
app/(app)/w/[workspace]/agents/[id]/versions/page.tsx
app/api/agents/[id]/publish/route.ts
lib/repos/agent-versions.ts
```

## Gate

1. Publishing creates an immutable version; a test that attempts to mutate a published version row fails.
2. Editing a draft while a published version is mid-run does not affect that run — verify with a long-running agent.
3. Version diff correctly marks added, removed, and modified nodes on canvas.
4. Restore creates a new draft without destroying history.
5. Publish is blocked on validation failure, and each failing node in the dialog is clickable to focus it on canvas.
6. All 6 templates instantiate into valid, runnable graphs. Run each one and confirm it produces sensible output.
7. Export → import round-trips an agent with identical graph and config.
8. Agents index handles the seeded set and stays responsive with 500 agents.

## Notes

The templates carry more demo weight than any other item in this session. Six workflows that a real agency would actually run, with real prompts, is what makes a reviewer believe the product is finished. Six templates called "Example Agent 1–6" undoes the trace view.

Test the draft-isolation case explicitly. It's the kind of bug that only appears in a demo, in front of an audience.
