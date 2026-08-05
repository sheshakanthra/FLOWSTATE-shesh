# CLAUDE.md — KILN

Read this file, then read `PROGRESS.md`, then read **only** the single session spec you were pointed at in `docs/phases/`. Do not read the other session specs. Do not read `docs/ROADMAP.md` unless explicitly told to.

---

## What this is

KILN is the operating system for an AI automation agency: CRM, projects, client portal, AI agent builder, automation builder, knowledge base, analytics, billing. We are building a deep vertical slice, not the whole product.

**In scope for this build:** design system, app shell, Agent Builder (full, including trace replay), AI Copilot (core), the Today dashboard, and the marketing hero demo.

**Out of scope:** CRM, project management, client portal, knowledge base, analytics, billing, marketplace, security/audit. Do not build these. Do not scaffold "for later." If a session spec doesn't name it, it doesn't exist.

---

## Working agreement

1. **One session = one spec = one gate.** The gate is at the bottom of your session spec. It is a command or a check that passes or fails. You are not done until it passes. You are also not done if you built things the spec didn't ask for.
2. **Never run git commands.** No `git add`, `git commit`, `git push`, `git checkout`, no branch creation, no stashing. The human commits manually between sessions. If you think something should be committed, say so in your summary.
3. **No AI attribution in anything.** No co-author trailers, no "Generated with" comments, no AI mentions in code comments, commit-message suggestions, or file headers.
4. **All shell commands must be POSIX / Git Bash compatible.** The dev environment is Windows running Git Bash. No PowerShell, no `cmd`, no Windows-only path separators, no `&&` chains that assume cmd semantics.
5. **Update `PROGRESS.md` as your final action** in every session: mark the session done, note any decision you made that isn't obvious from reading the code, and list anything you deliberately deferred.
6. **When the spec is ambiguous, stop and ask.** Do not invent a feature to resolve ambiguity. Inventing is how scope sprawls.
7. **When you finish early, stop.** Do not "improve" adjacent code, refactor unrelated files, or add features the spec omitted.

---

## Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 15, App Router | RSC by default; `"use client"` only where interactivity requires it |
| Runtime | React 19 | |
| Language | TypeScript, `strict: true` | No `any`. No `@ts-ignore`. `unknown` + narrowing instead. |
| Styling | Tailwind CSS v4 | CSS-first `@theme`, tokens defined once in `app/tokens.css` |
| Primitives | Radix UI | We wrap Radix ourselves; we do not `npx shadcn add` blindly |
| Motion | `motion` (Framer Motion 11+) | Tokens only, see below |
| Server state | TanStack Query v5 | |
| Client state | Zustand + immer | Slices, never one god store |
| Canvas | `@xyflow/react` (React Flow 12) | |
| Forms | React Hook Form + Zod | Schema shared between client and route handler |
| Charts | Recharts | Lazy-imported only |
| Icons | Lucide | |
| DB | Postgres + Drizzle ORM | All access behind `lib/repos/*`, never in components |
| LLM | Groq | Behind `lib/llm/provider.ts`, see below |

**Do not add a dependency that isn't in the table above or named in your session spec.** If you believe one is necessary, stop and ask.

---

## LLM provider rule

Groq is the only provider, but nothing outside `lib/llm/` may know that.

```ts
// lib/llm/provider.ts
export interface LLMProvider {
  stream(req: LLMRequest): AsyncIterable<LLMChunk>;
  complete(req: LLMRequest): Promise<LLMResponse>;
}
```

Feature code imports `getProvider()` and nothing else. No `groq-sdk` import outside `lib/llm/`. No model name string literals outside `lib/llm/models.ts`. Swapping providers must be a one-file change.

---

## Design rules — these are enforced, not suggested

The design language is already decided. You are implementing it, not designing it. Full specification lives in `docs/DESIGN.md`.

**Hard rules:**

1. **No color literals outside `app/tokens.css`.** No hex, no `rgb()`, no `hsl()`, no named colors in any `.tsx` or component `.css`. ESLint fails the build on this. Use token-derived Tailwind classes.
2. **No drop shadows except on floating layers** (dialog, popover, command palette, dropdown). Depth is built from luminance steps, 1px hairlines, and a top inset highlight. Three elevation levels exist. There is no fourth.
3. **AI is never a hue.** No violet or blue-to-pink gradients to signal AI. AI presence is achromatic: the `Shimmer` component, the `EmberEdge` component, and the single spectral hairline reserved for AI-authored content. Do not invent a fourth AI signal.
4. **Semantic colors have exactly one meaning each.** emerald = healthy/success. amber = at risk/pending. red = critical/failed. blue = informational/selected/focus. violet = third-party origin only. Never use a semantic color decoratively.
5. **Body text is 14px.** The type scale in `docs/DESIGN.md` is complete. Do not introduce a size outside it.
6. **All numerals are tabular.** `font-variant-numeric: tabular-nums` is global. Do not override it.
7. **Nothing bounces.** Springs are only for objects the user is physically dragging. Dropdowns, drawers, tabs, and toasts use the easing tokens with no overshoot.
8. **Default card radius is `md` (10px).** Not 2xl. `xl` (20px) is reserved for modals and the command palette.

**Motion tokens** (defined once in `lib/motion.ts`, never inlined):

```
instant  90ms   cubic-bezier(0.2, 0, 0, 1)
fast    160ms   cubic-bezier(0.2, 0, 0, 1)
base    240ms   cubic-bezier(0.32, 0.72, 0, 1)
slow    380ms   cubic-bezier(0.32, 0.72, 0, 1)
spring          { stiffness: 380, damping: 32 }
```

`prefers-reduced-motion` is read once at the root and provided by context. Individual components never query the media query themselves. Under reduced motion: all transform animation becomes a 90ms crossfade, and Shimmer renders as a static "Working" chip.

---

## Structure

```
app/
  (marketing)/            marketing routes, static/ISR
  (app)/w/[workspace]/    the product, streaming RSC
  api/
  tokens.css
  globals.css
components/
  ui/                     primitives only — no business logic, no data fetching
  patterns/               composed, still generic (DataTable, PageHeader)
features/
  agents/                 components/ hooks/ store/ lib/ types.ts
  copilot/
  today/
lib/
  llm/                    provider, models, prompts
  repos/                  all DB access
  motion.ts
  utils.ts
db/
  schema.ts               Drizzle
  seed.ts
docs/
  DESIGN.md
  ROADMAP.md
  phases/
```

**Feature folders own their components.** A component used by exactly one feature lives in that feature, not in `components/ui`. Promote to `components/ui` only on the second consumer, and only if it has no business logic.

---

## Code rules

- **Server Components by default.** Add `"use client"` at the leaf that needs it, not at the page.
- **No data fetching in `components/ui`.** Ever. Primitives take props.
- **No business logic in components.** It goes in `features/*/lib` or `lib/repos`.
- **Every mutation is optimistic with a rollback**, and registers an inverse with `useUndoable` so `⌘Z` works. Undo is a platform primitive here, not a text-editor feature.
- **Every list over 50 items is virtualized.** No exceptions, no "we'll do it later."
- **Errors say what happened and what to do next.** Never "Something went wrong." Never a bare toast with a status code.
- **Every interactive element is keyboard operable** with a visible focus ring. If you build a drag interaction, you build its keyboard path in the same session — not as a follow-up.
- **No `console.log` in committed code.** Use the logger in `lib/logger.ts`.
- **No commented-out code.** Delete it.

---

## Definition of done

A session is complete when all of these are true:

1. The gate in your session spec passes.
2. `pnpm typecheck` passes with zero errors.
3. `pnpm lint` passes with zero errors, including the color-literal rule.
4. Every state named in the spec is implemented — empty, loading, error, and disabled are not optional.
5. Reduced motion works on anything you animated.
6. Keyboard operation works on anything you made interactive.
7. `PROGRESS.md` is updated.
8. You did not build anything outside the spec.

If any of these fail, say so plainly in your summary rather than reporting success.
