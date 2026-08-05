# A3 — Overlay primitives

**Track:** A · Foundation
**Preconditions:** A2 gate passed

## Objective

Every floating layer, with correct focus management, and the only place in the product where real shadows exist.

## Scope

1. `Dialog`, `Drawer` (4 edges), `Sheet`, `Popover`, `HoverCard`, `Tooltip`, `DropdownMenu`, `ContextMenu`, `Toast` + `Toaster`.
2. `CommandPalette` **shell only** — the overlay, input, grouped result list, keyboard navigation, empty state, and a registry interface. No actual commands registered yet; feature tracks register their own.
3. Elevation: floating layers get `0 16px 48px -12px rgba(0,0,0,0.7)` plus backdrop blur, on top of the standard luminance step + hairline + inset highlight. This is the only shadow in the product.
4. Radius: `Dialog` and `CommandPalette` use `xl` (20px). Everything else uses `md`.
5. Motion: `fast` for tooltip/popover/dropdown, `base` for dialog/drawer/sheet. Drawers animate along their own axis and exit the way they entered. Nothing overshoots.

## Out of scope

No command implementations. No keyboard shortcut registry beyond what the palette itself needs (`⌘K` to open, arrows, `Enter`, `Esc`). No search backend — the palette filters a passed-in array.

## Files

```
components/ui/{dialog,drawer,sheet,popover,hover-card,tooltip,dropdown-menu,context-menu,toast}.tsx
components/ui/command-palette/{index.tsx,registry.ts,types.ts}
components/ui/*.stories.tsx
```

## Gate

1. Focus is trapped inside every modal layer, and returns to the trigger on close. Verify by keyboard, not by reading the code.
2. `Esc` closes every overlay. Nested overlays close innermost-first.
3. Scroll is locked behind modals with no layout shift from scrollbar removal.
4. Command palette: `⌘K` opens, arrows navigate, `Enter` selects, `Esc` closes, typing filters, empty state renders with a useful message.
5. All overlays render correctly in both themes and both densities.
6. Reduced motion: overlays crossfade in 90ms with no transform.
7. Toast stack handles 6 simultaneous toasts without overflowing the viewport.
8. Zero a11y violations across all stories.

## Notes

The palette registry should be a simple `registerCommands(scope, commands[])` with automatic cleanup on unmount, so later tracks can add commands from anywhere without touching this file. Get the interface right now; retrofitting it in Track D is painful.

Do not build fuzzy matching yet — a `includes()` filter is fine for the shell. Scoring comes in the polish pass.
