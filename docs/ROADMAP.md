# KILN — Product & Design Roadmap
### The operating system for an AI automation agency

---

## 0. The naming and positioning decision

The brief describes a product but never names it. Unnamed products produce generic design, so I'm pinning it: **KILN**.

An agency is a workshop. Raw material — a client's messy process, a half-written brief, an inbox of requests — goes in; finished, fired, load-bearing systems come out. The kiln is the thing that applies heat and time. That metaphor is doing real work later: it gives the product a vocabulary (*firing* a workflow, a *kiln run*, *greenware* for untested agents) and it gives the design its signature element.

**Positioning line:** *Your agency runs on people. KILN runs the rest.*

**Who this is for:** the 8-hour-a-day operator at a 5–60 person AI agency. Not the CEO who checks a dashboard on Sunday. The person with 40 tabs open who is simultaneously debugging a client's agent, chasing an invoice, and writing a scope doc. Every decision below optimizes for that person's hands.

---

## 1. Design language

### 1.1 The thesis: AI is a light, not a color

Almost every AI product signals "AI is happening here" with violet or a blue-to-pink gradient. It's a dead convention — it collides with your semantic palette, it can't express intensity, and it makes AI feel like a feature badge instead of an ambient property of the system.

**KILN's rule: AI presence is expressed achromatically, through luminance and motion — never through hue.**

Three mechanics carry it:

| Mechanic | What it is | Where it appears |
|---|---|---|
| **Shimmer** | A slow achromatic luminance sweep across a surface, 2400ms, 8% peak delta. Heat-haze over a kiln. | Any surface where an agent is currently working |
| **Ember edge** | A 1px top border that brightens from 12% → 34% white as an operation nears completion | Running jobs, streaming responses, uploads |
| **Spectral hairline** | A 1px line carrying the *only* full-spectrum gradient in the entire product | Exclusively on AI-authored content. Never decorative. |

Because AI never claims a hue, all five semantic colors stay unambiguous. When something is amber in KILN it means *at risk* — always, everywhere, no exceptions. That is the whole payoff.

**The one real risk I'm taking:** no accent color on the primary action. Primary buttons are near-white on graphite. In a category where every competitor has a blue "Create" button, a colorless one reads as confidence — the same reason a Leica has no red anywhere except the dot. If it tests poorly, the fallback is `--blue-500` on primary only; nothing else in the system depends on it.

### 1.2 Color

Dark-first. Light theme is a derived inversion, not a separate design.

```
FOUNDATION (dark)
--ink-000   #08090A   canvas — the true floor, used behind everything
--ink-050   #0D0F11   sunken (inset wells, code blocks, canvas backdrops)
--ink-100   #121417   surface — cards, panels, the default plane
--ink-200   #171A1D   raised — hover, popovers, dropdowns
--ink-300   #1E2226   overlay — dialogs, command palette
--ink-400   #2A2F35   border-strong / dividers with weight
--ink-500   #3A4047   border-subtle at 60% opacity

TEXT
--fg-000    #F2F4F5   primary
--fg-100    #A8B0B7   secondary
--fg-200    #6B7480   tertiary / metadata
--fg-300    #454C55   disabled / placeholder

SEMANTIC (strictly reserved — never decorative)
--emerald   #34C77B   healthy · succeeded · paid · on track
--amber     #E0A33C   at risk · pending · awaiting approval
--red       #E5484D   critical · failed · blocked · overdue
--blue      #4B93F5   informational · selected · link · focus ring
--violet    #8B7BF0   third-party / marketplace / non-KILN origin only
```

Five hues, one job each. Violet's narrow role means an installed marketplace agent is visually distinguishable from a first-party one at a glance — a trust signal that costs nothing.

**Every accent is a 3-token triple**, never a raw hex in a component: `--emerald-fg` (text, 100% chroma), `--emerald-bg` (fill, 12% over surface), `--emerald-line` (border, 28%). This is what stops the palette from disintegrating by Phase 6.

### 1.3 Type

| Role | Face | Why |
|---|---|---|
| Display | **Switzer** (600/700, tight tracking) | Geometric grotesk with slightly humanist terminals. Not Inter, not Geist, not a system stack — it has an actual voice at 40px+ and disappears politely at 13px. |
| UI / body | **Switzer** (400/500) | One family, two registers. Fewer files, more coherence. |
| Data / code | **Commit Mono** | Designed for long-session reading; excellent zero, unambiguous `Il1`. Tabular by default. |

Not JetBrains Mono. It's the correct default and therefore the one everyone recognizes — using it here would make KILN look like every other dev-adjacent product.

**Scale** — 1.2 ratio, capped deliberately. Enterprise density means no 72px headlines inside the app.

```
display-lg  40/44  -0.02em  600   marketing hero only
display-sm  32/38  -0.02em  600   marketing section heads
title-lg    24/30  -0.01em  600   page titles
title-md    18/24  -0.01em  600   panel and card headers
title-sm    15/20   0       600   list group headers
body        14/21   0       400   the default — everything is 14px
label       13/18   0       500   form labels, buttons, tabs
meta        12/16   0.01em  500   timestamps, counts, table headers
mono-sm     12/18   0       400   IDs, tokens, log lines, latencies
```

Numerals are `font-variant-numeric: tabular-nums` globally. In a product full of currency and metrics, jittering digits during a count-up animation is the single most obvious tell of amateur work.

### 1.4 Elevation — no drop shadows

Dark interfaces don't do shadows well; a black shadow on a near-black surface is invisible, so people fake it with a glow and the whole thing turns to mush. KILN builds depth the way physical materials do:

1. **Luminance step** — each layer is one `--ink-*` token brighter than its parent.
2. **Hairline** — 1px `--ink-500` at 60%.
3. **Top edge highlight** — `inset 0 1px 0 rgba(255,255,255,0.04)`, simulating a light source above.

Only floating layers (dialog, palette, popover) add a real shadow, and it's `0 16px 48px -12px rgba(0,0,0,0.7)` plus a backdrop blur. Three levels total. If you find yourself needing a fourth, the layout is wrong.

**Radius:** `sm 6 · md 10 · lg 14 · xl 20 · full`. Cards default to `md`, not the `2xl` in the brief — at 14px body copy in a dense table view, 24px corners eat vertical rhythm and read as consumer-app soft. `xl` is reserved for the command palette and modals, where the softness signals "this floats above the work." Nested radius rule: child radius = parent − padding.

### 1.5 Motion

```
instant   90ms   cubic-bezier(0.2, 0, 0, 1)      hover, focus, press
fast     160ms   cubic-bezier(0.2, 0, 0, 1)      tooltips, dropdowns, toggles
base     240ms   cubic-bezier(0.32, 0.72, 0, 1)  panels, drawers, tabs
slow     380ms   cubic-bezier(0.32, 0.72, 0, 1)  route transitions, shared elements
spring          { stiffness: 380, damping: 32 }   drag, reorder, node canvas
```

Rules that stop motion from becoming noise:

- **Nothing bounces.** Overshoot on a dropdown reads as a toy. Springs are for objects the user is physically dragging, and nothing else.
- **Motion respects direction.** A drawer from the right exits right. A row that was deleted collapses rather than fades — collapse says *gone*, fade says *maybe loading*.
- **Ambient motion runs only where work is happening.** Shimmer on an idle card is decoration; shimmer on a running agent is status.
- **`prefers-reduced-motion` replaces all transform/opacity animation with a 90ms crossfade** and disables shimmer entirely, substituting a static "Working" chip. It is not a code path added in Phase 18 — it's in the primitive from Phase 0.

### 1.6 The signature element: the Firing Bar

The one thing people will remember and screenshot.

A 3px strip pinned to the very top of the viewport, spanning full width, above everything. Idle, it's invisible. The moment any asynchronous work starts anywhere in the workspace — an agent run, a bulk update, a document being embedded, a teammate's automation firing — a segment appears in that strip. Each concurrent operation is its own segment, sized proportionally, carrying its own ember-edge brightening. Hovering the bar drops a panel listing every live operation with elapsed time, initiator avatar, and a cancel control.

It replaces four things at once: page-level spinners, the toast pile-up, the "is it still running?" anxiety, and the separate activity feed. And it means the product is *visibly alive* in a screenshot — an investor looking at a still frame sees three things running at once, which is the entire pitch.

---

## 2. Architecture

### 2.1 Routes

```
MARKETING            app.kiln.co                    PORTAL  <client>.kiln.co
/                    /w/[workspace]/                /
/product/agents      ├─ today                       ├─ timeline
/product/workflows   ├─ pipeline                    ├─ deliverables
/product/portal      ├─ clients/[id]                ├─ approvals
/pricing             ├─ projects/[id]/board         ├─ invoices
/customers/[slug]     │  └─ timeline|calendar|risk   ├─ documents
/changelog           ├─ agents/[id]/build           ├─ messages
/docs                │  └─ test|runs|versions       └─ meetings
/security            ├─ flows/[id]
                     ├─ knowledge/[collection]
                     ├─ insights
                     ├─ inbox
                     ├─ market
                     └─ settings/*
```

Three Next.js route groups: `(marketing)` static + ISR, `(app)` dynamic + streaming RSC, `(portal)` its own root layout, its own middleware, its own auth. The portal shares tokens with the app but not components — a client-facing surface with an admin sidebar accidentally rendered in it is a security incident, and the cleanest defense is that the component doesn't exist in that bundle.

### 2.2 Data model (core tables)

```
workspaces      id, slug, plan, seats, settings_jsonb
members         workspace_id, user_id, role, last_seen_at
clients         workspace_id, name, health_score, arr, owner_id, portal_enabled
contacts        client_id, name, email, role, influence, last_touch_at
deals           client_id, stage, value, probability, ai_score, close_date
projects        client_id, status, health, budget_cents, start, target_end
tasks           project_id, assignee_id, status, priority, estimate, blocked_by[]
agents          workspace_id, graph_jsonb, version, status, published_at
agent_runs      agent_id, trigger, input, output, tokens, cost_cents, latency_ms, trace_jsonb
flows           workspace_id, graph_jsonb, enabled, last_fired_at
flow_runs       flow_id, status, steps_jsonb, duration_ms
documents       collection_id, title, source, sync_state, checksum
chunks          document_id, content, embedding vector(1536), metadata_jsonb
threads         workspace_id, entity_type, entity_id, resolved_at
messages        thread_id, author_id, body_json, mentions[]
invoices        client_id, amount_cents, status, due_at, stripe_id
audit_events    workspace_id, actor_id, action, entity, before, after, ip, at
```

Row-level security on `workspace_id` at the database, not the ORM. Every table gets it in Phase 1, before there is any data worth protecting.

### 2.3 State

| Concern | Tool | Note |
|---|---|---|
| Server data | TanStack Query | 30s stale, optimistic mutations with rollback |
| Initial render | RSC + streaming | Shell → data, never a full-page spinner |
| Ephemeral UI | Zustand slices | Palette, panels, selection, density, copilot dock |
| Builder canvas | Zustand + immer, undo stack | 100-step ring buffer per canvas |
| Collaboration | Yjs over WebSocket | Presence, cursors, comment threads |
| Forms | React Hook Form + Zod | Schema shared with the API handler |

**Undo is a platform primitive, not a feature.** A `useUndoable` hook wraps every mutation with an inverse. `⌘Z` works on a deleted task, a moved kanban card, a bulk status change, and a disconnected node in the agent builder. Products where undo only works in the text editor feel fragile; products where it works everywhere feel safe, and *feeling safe* is what makes a power user willing to move fast.

---

## 3. Phases

Nineteen phases, not eighteen. **The brief's phase list omits the Client Portal** while describing it as a major surface — it's a separate root layout, separate auth, separate permission model, and separate design register (calmer, less dense, more explanatory). It cannot be folded into CRM or Project Management without one of them absorbing a second product. It's Phase 6.

Each phase is shippable. Each ends with a gate you can fail.

---

### Phase 0 — Foundation & Design System

**Objective** · Make every later phase cheap by making the primitives correct once.

**Ships** · Token pipeline (CSS vars → Tailwind theme → TS types, one source of truth), 40 base components, Storybook with dark/light and comfortable/compact toggles, motion primitives, the Firing Bar, icon set.

**UX goal** · A developer can assemble a plausible screen in 20 minutes without inventing a single value.

**Components** · Button (5 variants × 4 sizes), Input, Select, Combobox, Checkbox, Radio, Switch, Slider, Tabs, Card, Dialog, Drawer, Popover, HoverCard, Tooltip, ContextMenu, DropdownMenu, Toast, Badge, Avatar/AvatarGroup, Progress, Skeleton, Separator, ScrollArea, Breadcrumb, Table primitives, EmptyState, ErrorState, KeyboardHint, Shimmer, EmberEdge, FiringBar, Kbd, Tag, Stepper, Accordion, TreeView, ResizablePanel, SplitPane, Sheet.

**Routes** · `/_storybook` only.

**APIs** · None.

**Data** · None.

**State** · `useTheme`, `useDensity`, `useFiringBar`, `useUndoable`.

**Motion** · The five tokens. `<Motion>` wrapper reading `prefers-reduced-motion` once at the root and providing it via context, so no component queries the media query itself.

**Acceptance** ·
1. Zero hard-coded colors outside `tokens.css` — enforced by an ESLint rule that fails CI on hex literals in `.tsx`.
2. Every component has default / hover / focus-visible / active / disabled / loading / error states in Storybook.
3. Density toggle changes row height 40px → 32px across every component with no clipping or reflow bug.
4. Firing Bar handles 12 concurrent segments without layout thrash.
5. Light theme derives from the same tokens; no component ships a `dark:` variant with a bespoke hex.

**Perf** · Component bundle ≤ 45KB gzip. Storybook builds < 60s.

**A11y** · Every interactive element reachable and operable by keyboard. Focus ring is `--blue` 2px offset 2px, visible on every surface tier. Contrast ≥ 4.5:1 body, ≥ 3:1 for `--fg-200` metadata at 12px+. Radix under everything with a menu, listbox, or dialog role.

**Tests** · Storybook interaction tests per component; axe on every story; visual regression snapshots in both themes and both densities.

---

### Phase 1 — Authentication, Workspace & Permissions

**Objective** · A real multi-tenant boundary before any feature can leak across it.

**Ships** · Email + OAuth + SAML stub, workspace creation, invitations, five roles (Owner / Admin / Member / Contractor / Client), workspace switcher, session management, onboarding.

**UX goal** · Sign-up to a populated workspace in under 90 seconds, including seeded demo data so the product is never empty on first sight.

**Components** · AuthShell, OTPInput, WorkspaceSwitcher (⌘K-searchable), RoleBadge, PermissionGate, InviteDialog, OnboardingChecklist, SessionTable.

**Routes** · `/login`, `/signup`, `/verify`, `/join/[token]`, `/w/new`, `/w/[workspace]/onboarding`.

**APIs** · `POST /auth/*`, `POST /workspaces`, `POST /invites`, `PATCH /members/:id/role`, `GET /me`.

**Data** · `users`, `workspaces`, `members`, `invites`, `sessions`.

**State** · Session in a RSC-readable cookie; `usePermissions()` hydrated once per navigation, never refetched per component.

**Motion** · Auth steps slide horizontally 24px with a crossfade — the flow reads as a sequence, not a set of pages.

**Acceptance** ·
1. RLS verified: an authenticated user issuing a raw query for another workspace's row gets zero rows, proven by an integration test.
2. `<PermissionGate>` hides *and* the API rejects — never one without the other.
3. Role changes propagate to open sessions within 10s.
4. Contractors see only assigned projects; a direct URL to an unassigned project returns 404, not 403 (403 confirms existence).
5. New workspace lands with 3 clients, 2 projects, 1 agent of seed data.

**Perf** · Auth pages < 90KB JS. Session check adds < 15ms to middleware.

**A11y** · Full keyboard auth flow. OTP input handles paste. Errors announced via `aria-live`.

**Tests** · Permission matrix — 5 roles × 12 resources × 4 actions, table-driven. Invite expiry, replay, and cross-workspace token reuse.

---

### Phase 2 — Marketing Website

**Objective** · Convince someone in 8 seconds that the people who built this are serious.

**Ships** · Hero with a live working demo, product pages, pricing with a seat/usage calculator, customer stories, changelog, docs shell, security page.

**UX goal** · The hero *is* the product. No mockup image, no looping video.

**The hero, specifically** · A single input: *"Describe a task your agency does over and over."* The visitor types real text. On submit, a live Claude call streams back an actual agent graph, which renders node by node into a real React Flow canvas — trigger, condition, tool call, output — with edges drawing in as each node lands. Then it runs on the visitor's own example and streams the result. No sign-up. Rate-limited by IP, 3 runs, then a soft gate.

This is the entire pitch delivered in 15 seconds by the visitor's own hands, and it's the one place I'd spend real engineering effort on the marketing site. Everything below the fold can be conventional; this cannot.

**Components** · HeroBuilder, StreamingGraph, LogoWall, FeatureSplit, MetricCounter, PricingCalculator, TestimonialCard, CaseStudyHero, FAQAccordion, CTABand, Footer, DocsSidebar, ChangelogEntry.

**Routes** · As mapped in §2.1.

**APIs** · `POST /api/demo/generate` (streaming, rate-limited, no persistence), `POST /api/demo/run`, `POST /api/leads`.

**Data** · `leads`, `demo_sessions` (24h TTL).

**State** · Local only. No client-side store on marketing.

**Motion** · One orchestrated page-load sequence: nav fades, headline rises 16px, input focuses itself, ambient shimmer starts. Scroll reveals are 12px + fade at `base`, staggered 60ms, once only — never on scroll-back. Section transitions use a scroll-linked, not time-linked, progress value so scrubbing feels physical.

**Acceptance** ·
1. LCP < 1.2s on Moto G4 / Fast 3G.
2. Hero demo produces a valid, runnable graph for 9 of 10 plain-English inputs (fixture-tested).
3. Demo failure degrades to a pre-built example graph with a quiet "showing a saved example" note — never an error screen.
4. Lighthouse ≥ 95 on all four categories, every page.
5. OG images generated per route at the edge.

**Perf** · Marketing JS ≤ 120KB gzip total; React Flow lazily imported only when the hero enters the viewport. Fonts self-hosted, `font-display: swap`, subset to Latin.

**A11y** · Hero demo fully usable by keyboard and screen reader; the streaming graph has a parallel `aria-live` textual description of each node as it appears. Reduced motion renders the graph complete, without draw-in.

**Tests** · Playwright across 4 viewports; visual regression per section; the 10 hero-input fixtures.

---

### Phase 3 — Today (the dashboard)

**Objective** · Replace the KPI-card wall with something an operator actually opens first every morning.

**Ships** · A single prioritized surface. Not a grid of metrics — a ranked list of what needs a human today, with the metrics as supporting context.

**The structural idea** · Three zones, top to bottom:

1. **Needs you** — a ranked queue. Approvals waiting, agent runs that failed, deals gone cold, invoices overdue, review requests. Each row is actionable inline: approve, retry, snooze, delegate, open. Ranked by a scoring function (blast radius × time-decay × client value), and the score is *inspectable* — hover shows why this row is third.
2. **In flight** — live projects, running agents, active automations. This zone breathes: shimmer where agents work, ember edges on progress.
3. **The shape of things** — revenue, pipeline, utilization, agent spend. Four charts, no cards. Sparkline-first, expand to full on click.

**UX goal** · Zero to first meaningful action in under 5 seconds. If the top row isn't usually the right thing to do next, the ranking function is wrong and gets tuned — this is the one screen where you instrument and iterate.

**Components** · PriorityRow, ScoreExplainer, InFlightCard, LiveMetric, Sparkline, RevenueChart, QuickCreate, ActivityRail, DeadlineStrip, DashboardGrid (drag/resize, per-user layout).

**Routes** · `/w/[ws]/today`.

**APIs** · `GET /priorities`, `GET /metrics/summary`, `GET /activity`, `PATCH /layouts/me`, SSE `/live`.

**Data** · `priority_items` (materialized, refreshed on event), `dashboard_layouts`, `activity_events`.

**State** · Query with 20s refetch; SSE patches the cache directly rather than invalidating, so live updates don't cause a visible refetch flash.

**Motion** · Count-ups only on first mount, 900ms, ease-out, tabular numerals. New priority rows slide in from the top with a 400ms `--blue-bg` wash that fades — enough to notice, not enough to distract. Resolved rows collapse.

**Acceptance** ·
1. Full paint < 800ms with 500 priority items in the workspace.
2. Layout drag/resize persists per user and survives reload.
3. Score explainer shows the actual factor weights, not a generic sentence.
4. Live updates arrive < 2s from event.
5. Empty state for a new workspace suggests three concrete first actions, each one click.

**Perf** · Priority query < 120ms p95. Charts render from pre-aggregated rollups, never raw rows.

**A11y** · Priority queue is a proper `listbox`; `j`/`k` navigate, `Enter` opens, `e` archives. Live region announces new high-priority items only.

**Tests** · Ranking function unit tests against 20 scenarios. SSE reconnect with backoff. Layout persistence across devices.

---

### Phase 4 — CRM & Client Management

**Objective** · Pipeline and relationship intelligence dense enough that nobody keeps a parallel spreadsheet.

**Ships** · Kanban pipeline, contacts, activity timeline, email/calendar sync, AI lead scoring, client health, forecasting.

**UX goal** · Bulk operations are first-class. Select 30 deals, change stage, reassign owner, apply a tag — three keystrokes, one undo.

**Components** · PipelineBoard, DealCard, DealDrawer, ContactCard, RelationshipGraph, HealthGauge, ActivityTimeline, EmailThread, ForecastChart, BulkActionBar, MultiSelectTable, SavedViews, FilterBuilder.

**Routes** · `/pipeline`, `/clients`, `/clients/[id]`, `/contacts/[id]`.

**APIs** · `GET/POST/PATCH /deals`, `/clients`, `/contacts`, `POST /deals/bulk`, `POST /ai/score`, `GET /forecast`, `POST /integrations/gmail/sync`.

**Data** · `clients`, `contacts`, `deals`, `activities`, `email_messages`, `health_snapshots`.

**State** · Optimistic drag between stages with rollback. Selection in Zustand, survives filter changes. Saved views in URL params so they're shareable by paste.

**Motion** · Cards lift 2px and gain a hairline on drag; the target column's background lightens one step. Drop settles with the spring. Health gauge animates only on change, never on mount.

**Acceptance** ·
1. Drag-and-drop stays at 60fps with 300 cards.
2. Bulk edit of 100 deals commits < 1.5s and is undoable as a single action.
3. Lead score exposes its top three contributing factors.
4. Email sync is incremental; a re-sync doesn't duplicate threads.
5. Health score recomputes within 60s of a triggering event.

**Perf** · Board virtualizes columns > 50 cards. Table virtualizes at 100 rows, handles 50k.

**A11y** · Drag-and-drop has a full keyboard path (`space` to lift, arrows to move, `space` to drop) with `aria-live` position announcements. Not an afterthought — dnd-kit's keyboard sensor configured in the first commit.

**Tests** · Drag permutations, bulk undo, sync idempotency, score determinism.

---

### Phase 5 — Project Management

**Objective** · Delivery tracking that survives the reality of agency work: shifting scope, shared people, hard client dates.

**Ships** · Board, timeline/Gantt, calendar, milestones, dependencies, sprints, resource allocation, AI estimation, risk detection.

**UX goal** · Changing one date shows you every downstream consequence *before* you commit it.

**Components** · TaskBoard, TaskRow, TimelineGantt, DependencyArrow, MilestoneMarker, CapacityHeatmap, SprintPanel, RiskBadge, EstimateChip, CriticalPath, ViewSwitcher.

**Routes** · `/projects`, `/projects/[id]/board|timeline|calendar|files|risks`.

**APIs** · `GET/POST/PATCH /projects`, `/tasks`, `POST /tasks/bulk`, `POST /ai/estimate`, `GET /risks`, `GET /capacity`.

**Data** · `projects`, `tasks`, `dependencies`, `milestones`, `sprints`, `allocations`, `risks`.

**State** · Local dependency graph for instant critical-path recompute on drag; server reconciles after drop.

**Motion** · Dragging a Gantt bar ghosts every dependent bar to its projected new position in real time, with the critical path highlighted. This is the phase's memorable moment and it's worth building properly.

**Acceptance** ·
1. Critical path recomputes < 50ms for 500 tasks.
2. Circular dependencies rejected at creation with the offending cycle named.
3. Risk detection flags overallocation, slipping milestones, and stale tasks with the evidence attached.
4. AI estimates cite the historical tasks they're based on.
5. View switches preserve scroll position, filters, and selection.

**Perf** · Gantt canvas-rendered above 200 tasks. Timeline scroll 60fps across a 2-year span.

**A11y** · Every view has a keyboard-navigable table equivalent — the Gantt is a visualization, not the only door to the data.

**Tests** · Dependency cycle detection, critical path against known graphs, capacity math, timezone-safe date handling.

---

### Phase 6 — Client Portal *(added)*

**Objective** · The surface a client's CFO sees. It has to feel expensive and say nothing internal.

**Ships** · Branded portal, project timeline, deliverables with version history, approvals, invoices and payment, documents, messaging, meeting recordings with AI summaries.

**UX goal** · A different register entirely — lower density, larger type, more explanation, zero jargon. The client should never see the words "agent," "run," or "token."

**Components** · PortalShell, ClientTimeline, DeliverableCard, VersionHistory, ApprovalFlow, InvoiceTable, PaymentSheet, DocumentViewer, MeetingSummary, PortalMessenger, BrandingProvider.

**Routes** · `<client>.kiln.co/*` — own root layout, own middleware, own bundle.

**APIs** · `GET /portal/*` (separately-scoped tokens), `POST /portal/approvals`, `POST /portal/payments`.

**Data** · `portal_users`, `deliverables`, `versions`, `approvals`, `invoices`, `portal_messages`, `branding`.

**State** · Minimal. Server-rendered by default; the portal should work with JS disabled for reading.

**Motion** · Restrained. Approvals get a genuine moment — a signature-style confirmation with a 600ms seal animation — because approving a deliverable is a real commitment and the interface should acknowledge it.

**Acceptance** ·
1. No internal data reachable from any portal endpoint — verified by a test that enumerates every route with a portal token.
2. Branding (logo, accent, subdomain) applied without a rebuild.
3. Approvals produce an immutable audit record with timestamp, IP, and identity.
4. Portal passes AA with a client's arbitrary brand color, or the color is auto-adjusted and the client is told.
5. Invoice payment via Stripe with receipt.

**Perf** · Portal bundle ≤ 90KB. Works on a 5-year-old iPad — a genuine constraint, because that's what client-side executives use.

**A11y** · AA minimum, AAA on body text. This surface will be procurement-reviewed.

**Tests** · Data-leak enumeration, branding contrast, payment flow, approval immutability.

---

### Phase 7 — AI Copilot

**Objective** · Make AI ambient rather than a chat page you visit.

**Ships** · A persistent dock (⌘J) that knows where you are, what's selected, and what you're allowed to do — and can act, not just answer.

**Context model** · The copilot receives a typed context envelope on every message: route, entity type + id, current selection, open filters, visible date range, recent actions. Not a page-name string — actual structured context. That's what makes the difference between "an AI that answers" and "an AI that already knows."

**Actions** · Every action is a declared tool with a Zod schema, a permission requirement, and a preview renderer. The copilot never mutates silently: it proposes a diff, you approve. `create_proposal`, `draft_email`, `build_automation`, `summarize_thread`, `analyze_metric`, `search_knowledge`, `update_records`, `generate_report`.

**Components** · CopilotDock (docked / floating / fullscreen), MessageStream, ToolCallCard, ActionPreview, DiffView, ContextChips, PromptLibrary, CitationPill, SuggestionRail.

**Routes** · Overlay on all app routes; `/copilot/[thread]` for history.

**APIs** · `POST /copilot/stream` (SSE), `POST /copilot/execute`, `GET /copilot/threads`, `GET /copilot/context`.

**Data** · `copilot_threads`, `copilot_messages`, `tool_calls`, `prompt_library`.

**State** · Dock mode and width in Zustand, persisted. Context derived from route + selection stores, recomputed on navigation.

**Motion** · Responses stream token-by-token with a 1px caret. Tool calls render as a card that shimmers while executing and settles to a result. Action previews slide up from the composer with a spectral hairline on top — the only place that gradient appears in the app.

**Acceptance** ·
1. Context envelope is correct on 100% of routes — asserted by a test that visits every route and snapshots the envelope.
2. No destructive action executes without explicit approval.
3. Streaming first token < 700ms p95.
4. Every factual claim about workspace data carries a citation that navigates to the source record.
5. Dock resizes without reflowing the page beneath it; the layout reserves its width.
6. Actions respect the caller's role — a Contractor's copilot cannot delete a client.

**Perf** · Dock lazily loaded. Message list virtualized past 60 messages.

**A11y** · Streaming text announced in complete sentences, not per token. Tool approvals are focusable, keyboard-confirmable, and describe consequences in their accessible name.

**Tests** · Tool schema validation, permission enforcement per role, context correctness per route, streaming interruption and resume.

---

### Phase 8 — AI Agent Builder

**Objective** · The flagship. A visual environment where building an agent feels like engineering, not configuration.

**Ships** · Node canvas, typed connections, memory and knowledge attachment, triggers, conditions, tools, a test console, execution traces, version history, templates.

**UX goal** · Build → test → see exactly why it did that → fix, without leaving the canvas.

**The differentiating idea** · **Time-travel traces.** After a run, scrub a timeline and the canvas replays it: nodes light in sequence, edges carry the actual payload, each node shows its input, output, latency, and token cost at that moment. Debugging an agent by reading a JSON log is the current state of the art and it's miserable. Watching it happen on the graph you drew is the product.

**Components** · AgentCanvas, NodeLibrary, node types (Trigger / LLM / Tool / Condition / Loop / Memory / Knowledge / Transform / Output / Human-in-loop), TypedPort, ConnectionValidator, InspectorPanel, TestConsole, TraceTimeline, TraceScrubber, CostMeter, VersionDiff, TemplateGallery, MiniMap.

**Routes** · `/agents`, `/agents/[id]/build|test|runs|versions`.

**APIs** · `GET/POST/PATCH /agents`, `POST /agents/:id/run`, `GET /agents/:id/runs/:runId/trace`, `POST /agents/:id/publish`, `GET /agents/:id/versions`.

**Data** · `agents` (graph_jsonb), `agent_versions`, `agent_runs`, `run_steps`, `agent_templates`.

**State** · Zustand + immer, 100-step undo. Canvas transform separate from graph state so panning never triggers a graph re-render. Autosave debounced 800ms with a visible save indicator.

**Motion** · Nodes settle with the spring on drop. Connections draw as an animated path, 200ms. Invalid targets desaturate while dragging a port. During a live run, the active node shimmers and its outgoing edge shows a traveling pulse.

**Acceptance** ·
1. 60fps pan/zoom with 300 nodes and 400 edges.
2. Type-incompatible ports cannot connect, and the reason appears on hover before the attempt.
3. Undo/redo covers add, delete, move, connect, disconnect, and property edits.
4. Trace replay is frame-accurate against the recorded run.
5. Publishing creates an immutable version; a running production agent is unaffected by draft edits.
6. Cost meter shows per-node token spend within 5% of the provider's billed figure.

**Perf** · Nodes outside the viewport unmount above 100 nodes. Graph JSON ≤ 2MB. Canvas interaction stays off the main thread where possible.

**A11y** · Complete keyboard graph editing: `Tab` between nodes, `Enter` to inspect, `c` to start a connection, arrows to target, `Enter` to complete. The node list is a navigable tree view mirroring canvas state. This is hard and most node editors skip it; skipping it fails enterprise procurement.

**Tests** · Graph validation, cycle handling, trace fidelity, version immutability, 300-node performance benchmark in CI.

---

### Phase 9 — Automation Builder

**Objective** · Cross-system workflows that fire on events — the plumbing that connects everything built so far.

**Ships** · Canvas sharing Phase 8's engine, trigger library (schedule, webhook, record change, email, form), conditions, branching, variables with scope, integration actions, AI-generated flows from a prompt, execution history.

**UX goal** · Describe the automation in a sentence, get a working draft graph, refine it visually. The AI produces a starting point, not a black box.

**Components** · FlowCanvas (extends AgentCanvas), TriggerPicker, ConditionBuilder, VariableInspector, IntegrationAction, TestFireButton, RunHistoryTable, RunDetailTrace, ErrorRetryPolicy, ScheduleEditor.

**Routes** · `/flows`, `/flows/[id]`, `/flows/[id]/runs`.

**APIs** · `GET/POST/PATCH /flows`, `POST /flows/:id/fire`, `POST /flows/generate`, `GET /flows/:id/runs`, `POST /webhooks/:token`.

**Data** · `flows`, `flow_versions`, `flow_runs`, `run_steps`, `webhook_endpoints`.

**State** · Shared canvas store with a `mode` discriminator. Variable scope resolved client-side for live autocomplete in expression fields.

**Motion** · Test-fire animates the pulse along the executed path in real time; branches not taken dim to 40%. Seeing the road not travelled is what makes conditional logic legible.

**Acceptance** ·
1. Generated flows validate and run without manual repair in 8 of 10 fixture prompts.
2. Failed steps retry per policy with exponential backoff and appear in the Firing Bar.
3. Webhook endpoints are signed, replay-protected, and rate-limited.
4. Variable autocomplete only offers variables actually in scope at that node.
5. Disabling a flow stops it within 5s; in-flight runs finish or cancel per setting.

**Perf** · Run history table virtualized, filterable across 100k runs, query < 200ms.

**A11y** · Condition builder is fully form-based and keyboard-complete; the canvas is a view onto it, not the only editor.

**Tests** · Trigger firing, retry/backoff, scope resolution, webhook signature verification, generation fixtures.

---

### Phase 10 — Knowledge Base

**Objective** · A retrieval system agents actually use, not a documents folder.

**Ships** · Collections, ingestion (upload, URL, Drive/Notion sync), chunking and embedding, hybrid semantic + keyword search, AI summaries and tagging, document relationships, version control, freshness tracking.

**UX goal** · Search returns passages, not files, with the surrounding context and a jump-to-source.

**Components** · CollectionGrid, DocumentViewer, ChunkHighlighter, SemanticSearchBar, ResultPassage, RelationshipMap, SyncStatusBadge, StalenessIndicator, TagCloud, VersionDiff, IngestDialog.

**Routes** · `/knowledge`, `/knowledge/[collection]`, `/knowledge/doc/[id]`.

**APIs** · `POST /knowledge/ingest`, `GET /knowledge/search` (hybrid), `POST /knowledge/sync/:source`, `GET /knowledge/related/:id`.

**Data** · `collections`, `documents`, `chunks` (pgvector, HNSW index), `sync_sources`, `document_links`.

**State** · Search results cached by query hash; ingestion progress via the Firing Bar.

**Motion** · Results stream in as they rank. Matched passages highlight with a 200ms wash. The relationship map uses a force layout that settles in 1.2s and then stops — a graph that jiggles forever is a toy.

**Acceptance** ·
1. Hybrid search (vector + BM25, reciprocal rank fusion) beats vector-only on a 50-query golden set.
2. Search p95 < 300ms at 100k chunks.
3. Re-ingesting an unchanged document is a no-op via checksum.
4. Stale documents (source changed, not re-synced) are visibly flagged.
5. Agent knowledge nodes query the same index with the same permissions as a human.

**Perf** · HNSW tuned and benchmarked. Embedding batched, backgrounded, resumable.

**A11y** · Search results are a proper list with landmark navigation. The relationship map has a paired outline view.

**Tests** · Retrieval quality on the golden set, chunking boundary correctness, sync idempotency, permission filtering in search results.

---

### Phase 11 — Analytics & Reporting

**Objective** · Charts that answer questions instead of decorating a page.

**Ships** · Revenue, retention, conversion, client performance, automation efficiency, agent cost and quality; interactive filters, drill-down, cohorts, forecasting, AI-written insights, scheduled reports.

**UX goal** · Every chart is a question you can push on. Click a bar, get the underlying rows.

**Components** · ChartFrame, RevenueChart, CohortGrid, FunnelChart, RetentionCurve, AgentCostChart, DrilldownSheet, FilterBar, DateRangePicker (with comparison), InsightCard, ReportBuilder, ExportMenu.

**Routes** · `/insights`, `/insights/[report]`, `/insights/builder`.

**APIs** · `GET /analytics/:metric`, `POST /analytics/query`, `POST /reports`, `GET /reports/:id/export`.

**Data** · `metric_rollups` (materialized, hourly), `reports`, `report_schedules`, `insights`.

**State** · Filters in URL — every analytics view is a shareable link. Query results cached 60s.

**Motion** · Lines draw left to right on first paint, 600ms. Filter changes morph the existing shape rather than re-drawing, so you can see what changed. Tooltips track the cursor with a 1px crosshair, no lag.

**Acceptance** ·
1. Any chart point drills to its source rows in ≤ 2 clicks.
2. Comparison periods render as a ghost series with a legible delta.
3. AI insights cite the metric and window; no unsupported claims.
4. Scheduled reports deliver as PDF and CSV on time.
5. All numbers reconcile with the CRM and billing sources — a nightly job asserts this and alerts on drift.

**Perf** · Charts from rollups only; dashboard of 8 charts loads < 1s. Drill-down query < 400ms.

**A11y** · Every chart has a `<table>` equivalent behind a toggle. Series distinguishable by pattern and label, not hue alone.

**Tests** · Aggregation correctness against fixtures, timezone/DST boundaries, export fidelity, reconciliation job.

---

### Phase 12 — Team Collaboration

**Objective** · Make the workspace feel occupied.

**Ships** · Presence, live cursors, comment threads on any entity, mentions, activity feed, notification center, approvals, assignment.

**UX goal** · You can tell who's in the room and what they touched, without asking.

**Components** · PresenceStack, LiveCursor, CommentThread, CommentAnchor, MentionInput, ActivityFeed, NotificationCenter, ApprovalCard, AssignmentPicker, ReadReceipt.

**Routes** · `/inbox`; overlays everywhere.

**APIs** · WS `/presence`, `POST /comments`, `GET /activity`, `POST /notifications/read`, `POST /approvals/:id`.

**Data** · `threads`, `messages`, `mentions`, `notifications`, `approvals`, `presence` (Redis, ephemeral).

**State** · Yjs awareness for presence; comments through Query with optimistic append.

**Motion** · Cursors interpolate between updates rather than teleporting — the difference between "networked" and "alive." Avatars enter with a scale from 0.8. New comments slide and settle.

**Acceptance** ·
1. Presence updates < 300ms perceived latency.
2. Comments anchor to entities and survive that entity's edits.
3. Mentions notify by the recipient's preference (in-app, email, digest) and respect quiet hours.
4. Notification center groups by entity, not by time — 40 unread notifications should be 6 groups.
5. Presence degrades gracefully offline and reconnects without duplicate avatars.

**Perf** · Presence via a single multiplexed WS. Cursor updates throttled to 30fps, batched.

**A11y** · Comments navigable by keyboard with resolve/reply shortcuts. Notifications announced once, never repeatedly.

**Tests** · Concurrent editing, comment anchoring across edits, notification preference matrix, WS reconnect.

---

### Phase 13 — Billing & Subscription

**Objective** · Money in both directions: KILN bills the agency; the agency bills its clients.

**Ships** · Plans, seat and usage metering, upgrade/downgrade with proration, agency-side invoicing, payments, dunning, tax, revenue recognition.

**Ships (UX)** · Usage is visible *before* the invoice. Nobody should be surprised.

**Components** · PlanSelector, UsageMeter, SeatManager, InvoiceBuilder, LineItemEditor, PaymentMethodCard, DunningBanner, TaxSettings, BillingHistory.

**Routes** · `/settings/billing`, `/billing/invoices`, `/billing/usage`.

**APIs** · Stripe Billing, `POST /invoices`, `POST /invoices/:id/send`, `GET /usage`, webhook handlers.

**Data** · `subscriptions`, `usage_records`, `invoices`, `line_items`, `payments`, `tax_rates`.

**State** · Usage polled hourly; billing state server-authoritative always.

**Motion** · Usage meters fill on mount; the bar shifts to `--amber` at 80% and `--red` at 95% with a single non-repeating pulse.

**Acceptance** ·
1. Proration matches Stripe's calculation exactly on 12 test scenarios.
2. Usage metering is idempotent under webhook retry and duplicate delivery.
3. Failed payments trigger dunning with configurable escalation.
4. Invoice PDFs are branded, tax-compliant, and archived immutably.
5. Downgrade below current seat count is blocked with a clear path to resolve.

**Perf** · Billing pages don't block on Stripe; skeleton then hydrate.

**A11y** · Payment forms fully labeled; Stripe Elements themed with KILN tokens and contrast-verified.

**Tests** · Webhook idempotency, proration scenarios, tax calculation, dunning state machine.

---

### Phase 14 — Marketplace & Integrations

**Objective** · Turn KILN from a tool into a platform.

**Ships** · Agent marketplace, workflow templates, integration directory, OAuth connection manager, plugin SDK, publisher flow, ratings, install analytics.

**UX goal** · Install to working in under 60 seconds, with required credentials requested inline rather than in a settings detour.

**Components** · MarketplaceGrid, ListingCard, ListingDetail, InstallFlow, CredentialPrompt, IntegrationDirectory, ConnectionCard, PublisherDashboard, RatingWidget, PermissionManifest.

**Routes** · `/market`, `/market/[slug]`, `/settings/integrations`, `/publish`.

**APIs** · `GET /market/listings`, `POST /market/install`, `POST /oauth/:provider/connect`, `POST /market/publish`.

**Data** · `listings`, `installs`, `connections` (encrypted credentials), `reviews`, `publishers`.

**State** · Install progress in the Firing Bar; connection health polled.

**Motion** · Install shows real steps completing — fetching, validating permissions, connecting, ready — not a fake progress bar. Honest progress builds more trust than fast progress.

**Acceptance** ·
1. Every listing shows a permission manifest before install, in plain language.
2. Third-party listings carry the `--violet` origin marker everywhere they appear.
3. OAuth tokens encrypted at rest, rotated, revocable in one click.
4. Uninstall removes all artifacts and reports what it removed.
5. Publisher submissions run automated validation before review.

**Perf** · Marketplace ISR-cached; search client-side over a prefetched index below 500 listings.

**A11y** · Permission manifests are readable structured lists, not a wall of scopes.

**Tests** · Install/uninstall round-trip, OAuth refresh and revocation, permission enforcement post-install.

---

### Phase 15 — Mobile, Responsive & PWA

**Objective** · Not a shrunken desktop. A deliberate subset for the phone.

**The decision** · Mobile ships **Today, Inbox, Copilot, Client Portal, and read-only project/CRM views**. The agent and automation builders are desktop-only, and the mobile app says so with a "send to desktop" action. Shipping a bad touch node editor is worse than shipping none — it damages the perception of the whole product.

**Ships** · Responsive breakpoints, touch targets and gestures, bottom navigation, PWA manifest, service worker, offline reads, push notifications, install prompt.

**Components** · MobileShell, BottomNav, SwipeableRow, PullToRefresh, MobileCopilot (full-screen sheet), TouchDrawer, DesktopOnlyNotice, OfflineBanner.

**Routes** · Same routes, adaptive layouts; builders gated.

**APIs** · Existing + `POST /push/subscribe`.

**Data** · IndexedDB cache; `push_subscriptions`.

**State** · Query persisted to IndexedDB; mutation queue for offline actions, replayed on reconnect with conflict surfacing.

**Motion** · Native-feeling: sheets follow the finger with rubber-banding at bounds; swipe actions reveal proportionally to drag distance, not on threshold.

**Acceptance** ·
1. All touch targets ≥ 44px.
2. Offline: cached data readable, mutations queued, queue visible and cancelable.
3. Installs to home screen on iOS and Android with correct icons and splash.
4. Push notifications deep-link to the exact entity.
5. No horizontal scroll at 320px on any shipped mobile route.

**Perf** · Mobile bundle ≤ 140KB. LCP < 1.8s on 4G mid-range Android.

**A11y** · Gestures always have a button equivalent. Dynamic Type up to 200% without breakage.

**Tests** · Real-device matrix (iOS Safari, Chrome Android), offline/online transitions, conflict resolution, push delivery.

---

### Phase 16 — Enterprise Security & Audit

**Objective** · Pass a security review without a remediation list.

**Ships** · SSO (SAML, OIDC), SCIM provisioning, custom roles, audit log with export, data residency, retention policies, IP allowlists, session policies, encryption key management, DPA and compliance surface.

**Components** · SSOConfig, SCIMStatus, RoleEditor, AuditLogTable, AuditFilters, RetentionPolicy, IPAllowlist, SessionPolicy, SecurityCenter, ComplianceExport.

**Routes** · `/settings/security`, `/settings/audit`, `/settings/sso`, `/security` (public trust page).

**APIs** · `/saml/*`, `/scim/v2/*`, `GET /audit` (paginated, filtered), `POST /audit/export`.

**Data** · `sso_configs`, `custom_roles`, `audit_events` (append-only, partitioned by month), `retention_policies`.

**State** · Server-authoritative. No security state cached client-side.

**Motion** · Deliberately minimal. Security settings should feel weighty and slightly slow — friction is correct here.

**Acceptance** ·
1. Every mutating action writes an audit event with actor, before/after, IP, and user agent — verified by a test that enumerates all mutation handlers.
2. Audit log is append-only at the database level; no application path can update or delete.
3. SCIM deprovisioning revokes access within 60s.
4. Custom roles compose from atomic permissions with no privilege-escalation path.
5. Audit export handles 1M events without timing out.

**Perf** · Audit queries < 500ms at 10M rows via partitioning and covering indexes.

**A11y** · Audit table keyboard-navigable with column sorting and screen-reader-friendly filter state.

**Tests** · Audit completeness enumeration, SAML assertion handling, SCIM lifecycle, permission escalation attempts, retention deletion verification.

---

### Phase 17 — Performance Optimization

**Objective** · Make it fast enough that speed becomes part of the brand.

**Ships** · Bundle analysis and splitting, RSC boundary audit, query optimization, caching layers, image pipeline, font loading, prefetch strategy, virtualization audit, memory-leak hunt, Web Vitals monitoring.

**Targets** ·

| Metric | Target |
|---|---|
| App shell JS | ≤ 180KB gzip |
| Any route incremental JS | ≤ 60KB gzip |
| LCP (app) | < 1.0s |
| INP | < 150ms p75 |
| CLS | < 0.02 |
| API p95 | < 200ms |
| Canvas frame rate | ≥ 55fps at p95 |
| Memory after 8h session | < 400MB, no upward drift |

**Acceptance** ·
1. Budgets enforced in CI; a PR exceeding them fails.
2. No route ships an unused heavy dependency (Monaco, React Flow, chart libs all lazily imported).
3. An 8-hour soak test shows flat memory.
4. RUM in production with p75/p95 dashboards and regression alerts.
5. Every list over 50 items is virtualized — audited, not assumed.

**Tests** · Lighthouse CI per route, bundle-size assertions, soak test, canvas benchmark at 300 nodes.

---

### Phase 18 — Final Polish & Production Launch

**Objective** · Close the gap between "works" and "feels finished." This is where perceived quality is actually won.

**Ships** · Command palette expanded to every action, complete keyboard map with a `?` overlay, every empty/loading/error/permission/success state audited, onboarding tours, tooltips and help, microcopy pass, error monitoring, status page, docs, launch.

**The polish audit** · Enumerate every route × every state (empty, loading, partial, error, permission-denied, success, offline) and review each one. It's tedious and it's the difference. A product where the empty states are as considered as the happy path is a product people trust.

**Components** · CommandPalette (fuzzy, scored, recent-weighted), ShortcutOverlay, TourStep, EmptyStateLibrary, ErrorBoundaryUI, StatusIndicator, WhatsNewPanel.

**Acceptance** ·
1. Every user-facing action is reachable from the command palette.
2. Every route has designed empty, loading, error, and permission states — no default fallbacks anywhere.
3. Every error message says what happened and what to do next; none say "Something went wrong."
4. Full keyboard operation of every core flow, verified by a keyboard-only walkthrough.
5. Zero AA violations across the product.
6. Error monitoring with source maps, alerting, and an owner per alert.

**A11y** · Full audit by an external tool plus a manual screen-reader pass on the ten highest-traffic flows.

**Tests** · Full E2E suite green; the state matrix reviewed; load test at 10× expected concurrency.

---

## 4. Reality check

Nineteen phases at this depth is a 6–10 engineer team for 12–18 months. That is what the brief describes, and the roadmap above is the honest version of it.

If the goal is a portfolio piece, a hackathon submission, or an investor demo, building all nineteen is the wrong move — you'd end up with nineteen thin things instead of four convincing ones. What actually persuades a judge or an investor is **depth in one place plus coherence everywhere else**.

**The slice I'd build:**

| Build | Why |
|---|---|
| **Phase 0** in full | Everything downstream is cheap or expensive depending on this. Non-negotiable. |
| **Phase 8** in full, including trace replay | This is the flagship. It's the thing nobody else has built well, and it's a five-second screenshot that explains the whole product. |
| **Phase 7** at 70% | Ambient AI with real context and previewed actions. Proves the thesis that AI is everywhere, not on a chat page. |
| **Phase 3** at 60% | The first screen anyone sees. Needs the priority queue and live In-flight zone; the analytics can be static. |
| **Phase 2 hero** only | The live demo hero. Skip the rest of the marketing site — one screenshot-worthy hero beats twelve mediocre sections. |
| Everything else | Designed, routed, and present as high-fidelity static screens with real seeded data. |

Four working surfaces at full depth plus a coherent design system reads as a product. Nineteen half-built ones read as a demo. The design language in §1 is what makes the static screens still feel like the same product — that's what it's for.

One note on visual direction: this deliberately isn't the dark terminal/HUD palette with a mint accent. That look is well-executed but it's become a recognizable signature across a lot of developer-tool projects, and this brief specifically asks for a language nobody can place. Graphite with strictly-semantic hues and achromatic AI signaling gets further from the pack, and the Firing Bar gives it a memorable element that doesn't depend on a color at all.

---

## 5. Immediate next step

Phase 0's real deliverable is a **proof screen** — one route built at full fidelity that exercises the entire token system, all three elevation levels, the semantic palette, both densities, the Firing Bar, and the shimmer. Build it before writing any feature code. If the design language doesn't survive a single dense, real screen, it won't survive nineteen phases.

The right candidate is the Agent Builder canvas with a trace replaying: it's the most demanding surface in the product, and if the tokens hold there they'll hold anywhere.
