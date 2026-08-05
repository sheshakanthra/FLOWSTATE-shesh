# A2 — Form & display primitives

**Track:** A · Foundation
**Preconditions:** A1 gate passed

## Objective

The primitives that appear on every screen, each with a complete state matrix, verified in Storybook.

## Scope

1. Storybook 8 configured with dark/light and comfortable/compact toolbar toggles, plus the a11y addon.
2. Components, all wrapping Radix where a Radix primitive exists:
   - `Button` — variants: primary, secondary, ghost, danger, link. Sizes: sm, md, lg, icon. States: default, hover, focus-visible, active, disabled, loading.
   - `Input`, `Textarea`, `Select`, `Combobox`, `Checkbox`, `Radio`, `Switch`, `Slider`
   - `Label`, `FormField` (label + control + description + error, wired for RHF)
   - `Tabs`, `Badge`, `Tag`, `Avatar`, `AvatarGroup`, `Kbd`, `Separator`, `ScrollArea`
   - `Card` (header / body / footer slots, `md` radius, hairline + top inset highlight)
3. Every component is token-driven and works in both themes and both densities with no clipping.
4. `Button` primary is **near-white on graphite, no accent color**. This is deliberate. Do not "fix" it to blue.

## Out of scope

No overlays (A3). No tables (A5). No motion beyond the `instant` and `fast` tokens on hover/focus. No business logic. No data fetching.

## Files

```
components/ui/{button,input,textarea,select,combobox,checkbox,radio,switch,slider}.tsx
components/ui/{label,form-field,tabs,badge,tag,avatar,kbd,separator,scroll-area,card}.tsx
components/ui/*.stories.tsx
.storybook/{main.ts,preview.tsx}
```

## Gate

1. `pnpm storybook` builds in under 60s.
2. Every component has stories covering default, hover, focus-visible, active, disabled, loading, and error where applicable.
3. Storybook a11y addon reports zero violations on every story.
4. Density toggle changes control height across all controls with no clipped text or broken alignment.
5. Theme toggle works on every story with no component retaining a dark-only value.
6. Tab through a story containing one of each control: focus ring is visible on every one, on every surface tier.
7. `pnpm lint` and `pnpm typecheck` → 0 errors.

## Notes

`FormField` is the piece most likely to be under-built. It needs to render the error state, wire `aria-describedby` and `aria-invalid`, and associate the label — all automatically. If consumers have to remember to pass ARIA props, it's wrong.

Loading state on `Button` must preserve width. A button that shrinks when it starts loading causes layout shift, which is the exact tell we're trying to avoid.
