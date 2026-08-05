# A4 — Motion, AI signal primitives, Firing Bar, undo

**Track:** A · Foundation
**Preconditions:** A3 gate passed

## Objective

The three mechanics that make KILN recognizable, plus the undo substrate every later mutation depends on.

## Scope

1. **`MotionProvider`** — reads `prefers-motion-reduce` once at the root, provides it via context. Export `useMotion()` returning the resolved tokens (already zeroed under reduced motion) so components never branch on the media query themselves.
2. **`Shimmer`** — slow achromatic luminance sweep across its container. 2400ms loop, 8% peak white delta, no hue. Wraps any surface where an agent is currently working. Under reduced motion it renders a static "Working" chip instead of animating.
3. **`EmberEdge`** — a 1px top border whose brightness interpolates from 12% to 34% white as a `progress` prop goes 0 → 1. Indeterminate mode pulses between 12% and 24% at 1800ms.
4. **`SpectralHairline`** — a 1px full-spectrum gradient line. This is the only gradient in the entire product. Component must throw a dev-mode warning if used more than once per rendered subtree, because it exists solely to mark AI-authored content.
5. **`FiringBar`** — the signature element. 3px strip pinned to the top of the viewport above everything, `z-index` above overlays. Invisible when idle. Each registered async operation becomes a proportionally sized segment with its own EmberEdge. Hovering drops a panel listing every live operation: label, initiator, elapsed time, cancel action.
   - Store: `useFiringBar()` with `start(op) → id`, `update(id, progress)`, `finish(id, status)`.
   - Must handle 12 concurrent segments without layout thrash.
   - Segments exit by collapsing width, not fading.
6. **`useUndoable`** — wraps a mutation with its inverse and pushes onto a global 100-step ring buffer. `⌘Z` / `⌘⇧Z` bound globally. Each entry carries a human-readable label surfaced in a toast ("Deleted 3 tasks — Undo").

## Out of scope

No real operations to feed the Firing Bar yet — stories drive it with mock operations. No persistence of the undo stack across reloads.

## Files

```
components/motion/{motion-provider.tsx,shimmer.tsx,ember-edge.tsx,spectral-hairline.tsx}
components/firing-bar/{index.tsx,store.ts,panel.tsx,types.ts}
lib/undo/{use-undoable.ts,store.ts,shortcuts.ts}
components/**/*.stories.tsx
```

## Gate

1. Storybook story drives the Firing Bar with 12 concurrent mock operations of varying duration. Frame rate stays at 60fps (measure with the Performance panel, don't estimate).
2. Hover panel lists all live operations with accurate elapsed time; cancel removes the segment.
3. Shimmer runs at 60fps on a surface containing 40 child elements.
4. Reduced motion: Shimmer becomes the static chip, EmberEdge stops pulsing and shows its progress statically, Firing Bar segments appear and disappear without animation.
5. `SpectralHairline` warns in dev when duplicated in a subtree.
6. Undo story: perform 5 mock mutations, `⌘Z` five times reverses all of them in order; `⌘⇧Z` redoes them. Ring buffer caps at 100 and drops oldest.
7. Zero a11y violations. Firing Bar is `aria-hidden` for the visual strip but the hover panel is a real, focusable list.

## Notes

This is the session where the product gets its face. Spend the time. If the Shimmer looks like a loading skeleton rather than heat haze, the delta is too high or the duration too short — it should be barely perceptible until you notice the whole surface is breathing.

The Firing Bar store must be usable from server-action callbacks and from client mutations. Design the interface for both now.
