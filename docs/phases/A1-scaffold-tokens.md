# A1 — Repo scaffold & token pipeline

**Track:** A · Foundation
**Preconditions:** empty repo

## Objective

Establish the project skeleton and the single source of truth for every color, size, radius, and motion value. Nothing visual ships this session. The gate is that design drift becomes mechanically impossible.

## Scope

1. Next.js 15 App Router project, TypeScript strict, pnpm.
2. Tailwind CSS v4 with CSS-first `@theme`. All tokens declared in `app/tokens.css`, consumed through `@theme` so they become Tailwind utilities.
3. Full token set from `docs/DESIGN.md`: `--ink-*`, `--fg-*`, five semantic triples (`-fg` / `-bg` / `-line` for each of emerald, amber, red, blue, violet), radius scale, type scale, spacing.
4. Both themes. Dark is the source; light is derived by overriding the same variable names under `[data-theme="light"]`. No component may ever ship a bespoke `dark:` hex.
5. Both densities. `[data-density="compact"]` overrides row height, control height, and vertical padding tokens. Comfortable = 40px control height, compact = 32px.
6. Typography: self-host Switzer (400/500/600/700) and Commit Mono (400) via `next/font/local`, subset Latin, `display: swap`. Set `font-variant-numeric: tabular-nums` globally.
7. **The ESLint color rule.** A custom rule (`eslint-plugin-local/no-color-literals`) that errors on hex literals, `rgb(`, `rgba(`, `hsl(`, and CSS named colors inside any `.ts`/`.tsx` file. Allowlist: `app/tokens.css` only. This must fail CI.
8. `lib/motion.ts` exporting the five motion tokens as typed constants.
9. Base scripts: `dev`, `build`, `typecheck`, `lint`, `test`.
10. Vitest + Testing Library configured. Playwright installed and configured, no tests yet.

## Out of scope

No components. No routes beyond the default page. No database. No auth. No Storybook (that's A2). Resist scaffolding folders you won't fill this session.

## Files

```
package.json  tsconfig.json  next.config.ts
app/tokens.css  app/globals.css  app/layout.tsx  app/page.tsx
lib/motion.ts  lib/utils.ts
eslint-plugin-local/no-color-literals.js
eslint.config.mjs  vitest.config.ts  playwright.config.ts
public/fonts/*
```

## Gate

Create `app/page.tsx` as a temporary token proof sheet rendering every token as a labeled swatch or specimen: all ink levels, all fg levels, all fifteen semantic tokens, every type scale step, every radius. Then:

1. `pnpm typecheck` → 0 errors
2. `pnpm lint` → 0 errors
3. Add `const c = "#ff0000"` to `app/page.tsx` → `pnpm lint` **fails**. Remove it.
4. Toggling `data-theme` between dark and light on `<html>` changes every swatch, with no element retaining a dark-only value.
5. Toggling `data-density` changes the control-height specimen from 40px to 32px.
6. Fonts load with no FOIT; numerals do not shift width when the digit changes.

## Notes

The ESLint rule is the highest-leverage thing in this session. Write it properly — walk `Literal` and `TemplateLiteral` nodes, match `/#[0-9a-fA-F]{3,8}\b/` and the function forms. A rule that only catches string literals in JSX attributes is not enough.

Light theme is a derivation, not a redesign. If a light value needs a hue that doesn't exist in dark, the token set is wrong — fix the token, not the theme.
