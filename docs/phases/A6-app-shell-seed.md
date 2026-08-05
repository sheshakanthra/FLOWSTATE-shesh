# A6 — App shell, workspace, seed data

**Track:** A · Foundation
**Preconditions:** A5 gate passed and the design review is done

## Objective

A running application shell with real data underneath it, so every later track builds against something real rather than mocks.

## Scope

1. **Database.** Postgres + Drizzle. Schema for the slice only: `workspaces`, `users`, `members`, `agents`, `agent_versions`, `agent_runs`, `run_steps`, `copilot_threads`, `copilot_messages`, `tool_calls`, `priority_items`, `activity_events`. Row-level security scoped on `workspace_id`.
2. **Repos.** `lib/repos/*` — every query lives here. No Drizzle import outside `lib/repos`.
3. **Auth shim.** Email + password with a session cookie. Real enough to be honest, not a full Phase 1. Roles: Owner, Admin, Member. `usePermissions()` hydrated once per navigation. `<PermissionGate>` hides **and** the route handler rejects — never one without the other.
4. **App shell.** `app/(app)/w/[workspace]/layout.tsx` — collapsible sidebar with nav, workspace switcher (⌘K searchable), user menu, the `FiringBar` mounted at root, the copilot dock slot (empty for now, reserving its width so Track C causes no reflow).
5. **Global shortcuts.** `⌘K` palette, `⌘J` copilot slot, `⌘\` toggle sidebar, `?` shortcut overlay, `g` then `a`/`t` to navigate to agents/today. Registered through the A3 registry.
6. **Seed script.** `pnpm seed` produces one workspace with 3 users, 3 clients' worth of context, 4 agents (2 published, 1 draft, 1 failing), ~40 agent runs with realistic traces and costs, 12 priority items, 60 activity events. **The seed data must look like a real agency's, not `foo`/`bar`.** Real-sounding agent names, plausible latencies, believable token costs, timestamps spread across the last 14 days.
7. Route stubs for `/today`, `/agents`, `/flows`, `/knowledge`, `/insights`, `/settings` — each rendering `PageHeader` + a designed `EmptyState`. No placeholder text anywhere.

## Out of scope

No CRM, projects, portal, knowledge, analytics, or billing implementation. No SSO. No invitations. No onboarding flow. Stub routes stay stubs.

## Files

```
db/{schema.ts,seed.ts,migrations/*}
lib/repos/*.ts
lib/auth/{session.ts,permissions.ts}
app/(app)/w/[workspace]/layout.tsx
app/(app)/w/[workspace]/{today,agents,flows,knowledge,insights,settings}/page.tsx
app/(auth)/{login,signup}/page.tsx
components/shell/{sidebar.tsx,workspace-switcher.tsx,user-menu.tsx,shortcut-overlay.tsx}
lib/shortcuts/registry.ts
```

## Gate

1. `pnpm seed && pnpm dev` → sign in → land on `/today` with populated nav and a workspace switcher listing real workspaces.
2. RLS proof: an integration test issuing a raw query for another workspace's `agents` row returns zero rows.
3. `<PermissionGate>` test: a Member hitting an Owner-only route handler directly via `fetch` gets rejected, not just hidden.
4. All six global shortcuts fire. `?` shows the overlay listing them.
5. Sidebar collapse persists across reload.
6. Every stub route renders a designed empty state with a specific next action.
7. Copilot dock slot reserves its width — opening it in Track C must not reflow the page.
8. Seed data reads as plausible. A reviewer scanning the agent list should not be able to tell it's fake.

## Notes

The seed data quality matters more than it sounds. Every screenshot for the rest of this build comes from it, and `Agent 1` / `Test Client` is the fastest way to make a $500M product look like a school project. Write 4 agent names that a real agency would ship.

Reserve the dock width now. Retrofitting a layout so a 380px panel doesn't push content is far worse than designing for it.
