# DESIGN.md — KILN design language

This is the implementation reference. The reasoning behind these choices is in `ROADMAP.md` §1; you do not need it to build. Values here are authoritative.

---

## Thesis

**AI is a light, not a color.** No violet, no blue-to-pink gradient, no "AI badge" hue. AI presence is achromatic — luminance and motion only. This keeps all five semantic colors unambiguous: amber always means at risk, everywhere, with no exceptions.

Three mechanics carry AI presence, and there is no fourth:

| Mechanic | Spec | Used for |
|---|---|---|
| `Shimmer` | achromatic luminance sweep, 2400ms loop, 8% peak white delta | any surface where an agent is currently working |
| `EmberEdge` | 1px top border, brightness 12% → 34% white as progress 0 → 1 | running jobs, streaming, uploads |
| `SpectralHairline` | 1px full-spectrum gradient — the only gradient in the product | AI-authored content only, once per subtree |

---

## Color

Dark is the source. Light overrides the same variable names under `[data-theme="light"]`. No component ships a bespoke `dark:` value.

```css
/* foundation */
--ink-000: #08090A;  /* canvas */
--ink-050: #0D0F11;  /* sunken — insets, code blocks, canvas backdrop */
--ink-100: #121417;  /* surface — cards, panels, default plane */
--ink-200: #171A1D;  /* raised — hover, popovers, dropdowns */
--ink-300: #1E2226;  /* overlay — dialogs, command palette */
--ink-400: #2A2F35;  /* border-strong */
--ink-500: #3A4047;  /* border-subtle, used at 60% opacity */

/* text */
--fg-000: #F2F4F5;   /* primary */
--fg-100: #A8B0B7;   /* secondary */
--fg-200: #6B7480;   /* tertiary, metadata */
--fg-300: #454C55;   /* disabled, placeholder */

/* semantic — one meaning each, never decorative */
--emerald: #34C77B;  /* healthy · succeeded · paid · on track */
--amber:   #E0A33C;  /* at risk · pending · awaiting approval */
--red:     #E5484D;  /* critical · failed · blocked · overdue */
--blue:    #4B93F5;  /* informational · selected · link · focus ring */
--violet:  #8B7BF0;  /* third-party / marketplace origin ONLY */
```

Every semantic color exists as a **three-token triple**, and components use the triple — never the raw value:

- `--{name}-fg` — text, full chroma
- `--{name}-bg` — fill, 12% over the parent surface
- `--{name}-line` — border, 28%

**Primary buttons carry no accent color.** Near-white on graphite. This is deliberate and is not a bug to fix.

---

## Elevation — no drop shadows

Depth is built from three stacked mechanics, not shadows:

1. **Luminance step** — each layer is one `--ink-*` token brighter than its parent
2. **Hairline** — 1px `--ink-500` at 60% opacity
3. **Top edge highlight** — `inset 0 1px 0 rgba(255,255,255,0.04)`

Only floating layers (dialog, drawer, popover, dropdown, command palette) add a real shadow:

```css
box-shadow: 0 16px 48px -12px rgba(0,0,0,0.7);
backdrop-filter: blur(8px);
```

**Three elevation levels exist. There is no fourth.** If a layout seems to need one, the layout is wrong.

---

## Radius

```
sm    6px   inputs, badges, small controls
md   10px   DEFAULT — cards, panels, buttons
lg   14px   large cards, canvas nodes
xl   20px   modals and command palette ONLY
full        avatars, pills
```

Not 2xl by default. At 14px body copy in a dense table, 24px corners eat vertical rhythm and read as consumer software.

**Nested radius rule:** child radius = parent radius − parent padding.

---

## Type

| Role | Face | Weights |
|---|---|---|
| Display + UI | **Switzer** | 400, 500, 600, 700 |
| Data + code | **Commit Mono** | 400 |

Not Inter, not Geist, not JetBrains Mono — those are the recognizable defaults, and using them makes KILN look like everything else.

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

The scale is complete. Do not introduce a size outside it.

`font-variant-numeric: tabular-nums` is set globally and must not be overridden. Jittering digits during a count-up is the most obvious tell of unfinished work.

---

## Density

Two modes via `[data-density]`.

| Token | Comfortable | Compact |
|---|---|---|
| control height | 40px | 32px |
| table row height | 40px | 32px |
| card padding | 16px | 12px |
| section gap | 24px | 16px |

Every component must work in both without clipping or misalignment.

---

## Motion

Defined once in `lib/motion.ts`. Never inlined.

```
instant   90ms   cubic-bezier(0.2, 0, 0, 1)      hover, focus, press
fast     160ms   cubic-bezier(0.2, 0, 0, 1)      tooltips, dropdowns, toggles
base     240ms   cubic-bezier(0.32, 0.72, 0, 1)  panels, drawers, tabs
slow     380ms   cubic-bezier(0.32, 0.72, 0, 1)  route transitions, shared elements
spring          { stiffness: 380, damping: 32 }   drag and reorder only
```

**Rules:**

1. **Nothing bounces.** Overshoot on a dropdown reads as a toy. Springs are only for objects the user is physically dragging.
2. **Motion respects direction.** A drawer from the right exits right. A deleted row *collapses*; it does not fade — collapse says gone, fade says maybe loading.
3. **Ambient motion runs only where work is happening.** Shimmer on an idle card is decoration. Shimmer on a running agent is status.
4. **Reduced motion** is read once at the root and provided by context. Components never query the media query. Under reduced motion: all transform animation becomes a 90ms crossfade, and Shimmer becomes a static "Working" chip.

---

## The signature element: the Firing Bar

A 3px strip pinned to the top of the viewport, above every other layer. Invisible when idle.

When any async work starts anywhere in the workspace — an agent run, a bulk update, a document embedding, a teammate's automation — a segment appears. Each concurrent operation is its own segment, sized proportionally, carrying its own `EmberEdge`. Hovering drops a panel listing every live operation with elapsed time, initiator, and a cancel control.

It replaces page spinners, toast pile-up, the "is it still running?" question, and a separate activity feed. It also means a still screenshot shows three things running at once, which is the entire product thesis in one frame.

Segments exit by collapsing width, never by fading.

---

## Writing

Interface copy is design material, not decoration.

- **Name things by what people control**, not how the system is built. "Notifications," not "webhook config."
- **Active voice, and the verb stays constant through the flow.** A button that says "Publish" produces a toast that says "Published."
- **Errors say what happened and what to do next.** Never "Something went wrong." Never a bare status code.
- **Empty states are invitations.** Every one names a specific next action.
- **Sentence case throughout.** No filler, no cleverness where specificity would do.
- **The client portal has a different register** — lower density, more explanation, and the words "agent," "run," and "token" never appear.
