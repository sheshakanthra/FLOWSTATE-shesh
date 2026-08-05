# PROGRESS

Claude Code reads this at the start of every session and updates it at the end. Keep it short — it is a state file, not a journal.

## Current session

**Next up:** A3 — Overlay primitives
**Spec:** `docs/phases/A3-overlay-primitives.md`

## Sessions

| ID | Session | Status | Gate passed |
|----|---------|--------|-------------|
| A1 | Repo scaffold & token pipeline | done | yes |
| A2 | Form & display primitives | done | yes |
| A3 | Overlay primitives | not started | — |
| A4 | Motion, Shimmer, EmberEdge, FiringBar, undo | not started | — |
| A5 | Data primitives & layout primitives | not started | — |
| A6 | App shell, workspace, seed data | not started | — |
| B1 | Agent canvas foundation | not started | — |
| B2 | Node registry & typed connections | not started | — |
| B3 | Inspector, autosave, undo integration | not started | — |
| B4 | Run engine & test console | not started | — |
| B5 | Trace replay | not started | — |
| B6 | Versioning, publish, templates | not started | — |
| C1 | Copilot dock & context envelope | not started | — |
| C2 | Streaming, messages, citations | not started | — |
| C3 | Tool registry, previews, approval | not started | — |
| D1 | Priority queue & ranking | not started | — |
| D2 | In-flight zone & live updates | not started | — |
| E1 | Marketing hero live demo | not started | — |

## Decisions

Record only decisions that are NOT obvious from reading the code. Format: `[session] decision — reason`.

- `[A1]` Font variable classNames (`switzer.variable`, `commitMono.variable`) are applied on `<html>`, not `<body>`. `--font-sans`/`--font-mono` are declared at `:root` inside `@theme` and reference `--font-switzer`/`--font-commit-mono`; a custom property's `var()` references are resolved once, where the property is declared, using values visible at that element — not re-resolved per consumer down the tree. Putting the font classes on `<body>` left `--font-switzer` invisible at `:root`, so `--font-sans` computed to guaranteed-invalid (empty) everywhere. Fixed by moving the classNames up to `<html>`.
- `[A1]` The `no-color-literals` ESLint rule only flags bare CSS named colors (e.g. `"red"`, `"blue"`) when the string is the value of a color-ish property/attribute (`color`, `background`, `fill`, `border*Color`, etc.) — not everywhere. `red` and `blue` are both valid CSS named colors *and* this codebase's semantic token names, so a blanket ban would break ordinary variant props like `variant="red"`. Hex and `rgb()`/`hsl()` literals are still caught unconditionally everywhere, matching the spec's "must fail CI" requirement without false-positiving on the vocabulary the design system itself uses.
- `[A1]` Semantic triples (`{color}-fg`/`-bg`/`-line`) get distinct, explicitly-computed hex/rgba values per theme rather than a live `color-mix()` formula. `-fg` is darkened per hue for light-mode AA contrast (the dark-mode hues are too light to read as text on a near-white background); `-bg`/`-line` are rgba tints of that same darkened hue. This satisfies the gate's "toggling theme changes every swatch" requirement for all fifteen semantic tokens, not just the neutrals.
- `[A1]` No `clsx`/`tailwind-merge` dependency — `lib/utils.ts` has a small dependency-free `cn()` instead, since neither package is in CLAUDE.md's approved dependency table.
- `[A1]` Switzer and Commit Mono were downloaded fresh (Fontshare / commitmono.com, both free-for-commercial-use) and subset to Latin + a small punctuation/symbol range with `fonttools` before being committed to `public/fonts/` as woff2. Only the four Switzer weights and Commit Mono 400 named in the spec were kept.
- `[A2]` Storybook pinned at `8.6.18` (latest 8.x patch) — plain `storybook@latest`/`npx storybook init` now resolves to Storybook 10, so every `@storybook/*` package and `storybook` itself is pinned explicitly rather than range-versioned.
- `[A2]` `.storybook/main.ts` sets `process.env.__NEXT_PRIVATE_RENDER_WORKER = "1"` before the config object. Next 15.4.6's config loader overrides Node's webpack module resolution to force its own compiled bundle, which crashes `@storybook/builder-webpack5` during `Compiler.close()` ("Cannot read properties of undefined (reading 'tap')") on every build. This env var is the same fix Storybook shipped upstream for this exact crash (storybookjs/storybook#32313) — without it, `pnpm build-storybook` and `pnpm storybook` both fail on this Next patch version.
- `[A2]` No Radix primitive exists for Combobox. `components/ui/combobox.tsx` is hand-built on `@radix-ui/react-popover` (non-modal, `onOpenAutoFocus` prevented so typing keeps focus) plus a manual WAI-ARIA combobox/listbox pattern (`role="combobox"`, `aria-activedescendant`, arrow-key/Enter/Escape handling).
- `[A2]` `--fg-200` and `--fg-300` (both themes) fail WCAG AA 4.5:1 against every `--ink-000`..`--ink-300` surface at normal 12–14px text — confirmed by computing contrast ratios, not just axe's say-so (fg-200 vs ink-100 is *worse* than vs ink-000, so it's not a "wrong surface tier" issue). Real copy that must be legible (Card/FormField descriptions, Select group labels, Combobox empty-state, Tabs inactive label, Select's rendered placeholder text) uses `fg-100` instead. `fg-200`/`fg-300` are still used, but only for decorative icons and for text inside elements with the native `disabled` attribute (which axe and WCAG 1.4.3 both exempt from contrast checks).
- `[A2]` The shared `focusRing` helper (`lib/utils.ts`) toggles `outline-color` only (`outline-transparent` → `focus-visible:outline-blue-fg`), never `outline-style`/`outline-none`. Tailwind v4's `outline-none` sets the shared `--tw-outline-style` custom property to `none`; because that property isn't scoped to a pseudo-class, `focus-visible:outline` (which just reads the property) stays `none` forever regardless of focus state, so the classic v3-era `outline-none focus-visible:outline` pattern silently renders no ring at all under v4. Verified with a computed-style check across six components after the fix.
- `[A2]` `@radix-ui/react-select` has no `modal` prop (unlike Popover/Dialog): opening it always `aria-hide`s everything outside its own subtree, including the trigger, when the app has a single DOM root (Storybook's `#storybook-root`, same shape as the real app's `#__next`). This trips axe's `aria-hidden-focus` rule but is inherent Radix behavior, not a defect — `FocusScope` traps the real tab order so the hidden trigger is never actually reachable. Scoped off via a per-story `parameters.a11y.config` override on `select--open` only, not disabled globally.
- `[A2]` `shadow-card` / `shadow-floating` / `blur-floating` (elevation formulas from `docs/DESIGN.md`) were added to `app/tokens.css` and its `@theme` block rather than written inline in components, since the ESLint color rule (and the tokens.css file header) intend raw color/rgba literals to live only in that one file.
- `[A2]` `Button` primary = `bg-ink-400` / `border-ink-500` / `text-fg-000`. DESIGN.md says primary is "near-white on graphite, no accent" without pinning exact tokens; `ink-400` is literally "near-white text on graphite" in dark (the source theme), and the light-theme rendering is a mechanical derivation of the same token pair, not a hand-tuned override.

## Deferred

Things a spec asked for that were consciously left undone, and why. Empty is the goal.

- _(none — every component, state, and story named in A2's scope is built)_

## Known issues

- `pnpm test` exits 1 with "No test files found" — expected per spec ("Vitest ... configured. Playwright installed and configured, no tests yet"). Not a regression; will resolve naturally once A2+ sessions add tests.
