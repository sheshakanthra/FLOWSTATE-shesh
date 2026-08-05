# B5 — Trace replay

**Track:** B · Agent Builder
**Preconditions:** B4 gate passed

## Objective

The differentiating feature of the entire product. Scrub a timeline and watch the agent's run replay on the graph you drew.

This is the screenshot that explains KILN. Build it properly or the whole slice loses its point.

## Scope

1. **Run history table** — `/agents/[id]/runs`. `DataTable` with status, trigger, duration, token count, cost, timestamp. Filterable by status and date. Virtualized.
2. **Trace view** — opening a run switches the canvas into replay mode: the graph renders read-only with a timeline scrubber pinned below it.
3. **The scrubber.** Horizontal timeline spanning the run's duration. Each node execution is a segment positioned and sized by its real start time and duration — overlapping segments stack, so parallelism is visible. Playhead drags; play/pause; speed control (0.5×, 1×, 2×, 4×); step-to-next-event with arrow keys.
4. **Canvas replay.** As the playhead moves, the canvas reflects the exact state at that instant: nodes that have not yet run are at 40% opacity; the currently-executing node shimmers; completed nodes show their emerald hairline; failed nodes red; skipped nodes dashed. Edges show a traveling pulse while carrying a payload.
5. **Node detail at playhead.** Clicking any node during replay opens the inspector in trace mode: the resolved input at that moment, the output, latency, tokens, cost, and the raw provider request/response behind a disclosure.
6. **Cost meter.** A running total that accumulates as the playhead advances, so you can see which node spent the money.
7. **Diff against a previous run** — select two runs, see which nodes changed output. Basic text diff is sufficient.
8. Deep link: a URL encodes run id and playhead position, so a trace at a specific moment can be shared.

## Out of scope

No editing during replay. No re-running from a midpoint. No flame graph.

## Files

```
features/agents/trace/{index.tsx,scrubber.tsx,timeline-segments.tsx,playhead.ts,replay-store.ts}
features/agents/trace/{node-detail.tsx,cost-meter.tsx,run-diff.tsx}
features/agents/runs/{table.tsx,filters.tsx}
app/(app)/w/[workspace]/agents/[id]/runs/page.tsx
app/(app)/w/[workspace]/agents/[id]/runs/[runId]/page.tsx
app/api/agents/[id]/runs/[runId]/trace/route.ts
```

## Gate

1. **Frame accuracy.** Scrub to an arbitrary timestamp; the canvas state matches what the `run_steps` rows say was true at that instant. Test this against three recorded runs with known step boundaries, as an automated test — not by eye.
2. Playhead drag stays at 60fps on a 40-step run. The canvas store split from B1 is what makes this possible; if it stutters, the coupling regressed.
3. Parallel node executions render as overlapping stacked segments, visibly concurrent.
4. Clicking a node mid-replay shows the resolved input at that moment, not the final input.
5. Cost meter total at the end of replay equals the run's recorded total exactly.
6. Deep link restores run and playhead position.
7. Arrow keys step event to event; `space` toggles play/pause. Full keyboard operation.
8. Reduced motion: replay still works, but node transitions crossfade rather than animate, and edge pulses are static highlights.
9. Run diff correctly identifies changed outputs between two runs of the same agent.

## Notes

**Stop here and do the second design review.** This is the flagship surface. Take screenshots. If the trace view doesn't look better than anything in the category, iterate on it before moving to Track C — the rest of the build is supporting cast.

The replay store should hold only the playhead timestamp and derive all node states from it, memoized. Do not store per-node state and mutate it as the playhead moves; that path leads to desync and is the reason most timeline scrubbers feel unreliable.
