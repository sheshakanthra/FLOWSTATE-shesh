# PROGRESS

Claude Code reads this at the start of every session and updates it at the end. Keep it short — it is a state file, not a journal.

## Current session

**Next up:** A2 — Form & display primitives
**Spec:** `docs/phases/A2-form-display-primitives.md`

## Sessions

| ID | Session | Status | Gate passed |
|----|---------|--------|-------------|
| A1 | Repo scaffold & token pipeline | done | yes |
| A2 | Form & display primitives | not started | — |
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

## Deferred

Things a spec asked for that were consciously left undone, and why. Empty is the goal.

- _(none yet)_

## Known issues

- `pnpm test` exits 1 with "No test files found" — expected per spec ("Vitest ... configured. Playwright installed and configured, no tests yet"). Not a regression; will resolve naturally once A2+ sessions add tests.
