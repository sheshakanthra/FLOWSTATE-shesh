# E1 — Marketing hero live demo

**Track:** E · Marketing
**Preconditions:** D2 gate passed

## Objective

A hero that *is* the product. A visitor types a real task in plain English and watches a working agent graph build itself and run — no sign-up, no mockup image, no looping video.

## Scope

1. **Hero.** Headline, subhead, and a single prominent input: *"Describe a task your agency does over and over."* The input self-focuses on load.
2. **Generation.** On submit, `POST /api/demo/generate` streams a graph. Nodes render onto a real React Flow canvas one at a time as they arrive, with edges drawing in as each node lands. Reuse the generation logic from C3's `create_agent_from_description`.
3. **Execution.** Once the graph completes, it runs on the visitor's own example and streams the result into an output panel with the same step log treatment as the product's test console.
4. **Rate limiting.** 3 runs per IP, then a soft gate offering sign-up. Not a hard wall — the third result stays visible.
5. **Failure degradation.** If generation fails or times out, fall back to a pre-built example graph with a quiet "showing a saved example" note. Never an error screen in the hero. Never a blank canvas.
6. **Page-load sequence** — one orchestrated moment: nav fades in, headline rises 16px, input focuses, ambient shimmer starts on the canvas frame. Everything else on the page uses a 12px-plus-fade scroll reveal at the `base` token, staggered 60ms, firing once and never on scroll-back.
7. **Below the fold, minimal:** a logo wall, one feature split section showing the trace replay with a real screenshot from D2, and a CTA band with the footer. That's all. Do not build twelve marketing sections.
8. Lazy-import React Flow only when the hero enters the viewport.

## Out of scope

No pricing page, product pages, customer stories, changelog, docs, blog, or FAQ. No testimonials. No case studies. One page.

## Files

```
app/(marketing)/page.tsx
features/marketing/hero/{index.tsx,input.tsx,streaming-graph.tsx,output-panel.tsx,fallback-graph.ts}
features/marketing/{logo-wall.tsx,feature-split.tsx,cta-band.tsx,footer.tsx}
app/api/demo/generate/route.ts
app/api/demo/run/route.ts
lib/rate-limit.ts
```

## Gate

1. **LCP under 1.2s** on simulated Moto G4 / Fast 3G. Measure it; do not estimate.
2. Ten fixture inputs in plain English produce valid, runnable graphs in at least nine cases. Commit the fixtures as a test.
3. Forcing a generation failure shows the fallback graph with its note — no error screen, no empty canvas.
4. Rate limit triggers on the fourth attempt with a soft gate; the third result remains on screen.
5. Marketing JS at or under 120KB gzip. React Flow is absent from the initial bundle — verify in the bundle analyzer.
6. Lighthouse at or above 95 on all four categories.
7. **Accessibility:** the hero is fully operable by keyboard, and an `aria-live` region describes each node in text as it appears, so the demo is comprehensible without sight.
8. Reduced motion: the graph renders complete rather than drawing in; the run still streams.
9. No horizontal scroll at 320px.

## Notes

Everything below the fold can be conventional. The hero cannot. If effort has to be cut anywhere in this session, cut the feature split, not the streaming graph.

The `aria-live` narration is not optional politeness — it's the difference between an impressive demo and one that fails an accessibility review in front of an enterprise buyer.

This is the last session in the slice. When it passes, take the screenshots and record the demo video before touching anything else.
