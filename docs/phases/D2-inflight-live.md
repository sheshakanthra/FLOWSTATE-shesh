# D2 — In-flight zone & live updates

**Track:** D · Today
**Preconditions:** D1 gate passed

## Objective

Make the workspace visibly alive. This is the zone that makes a still screenshot communicate that the product is running things.

## Scope

1. **In-flight zone** — live cards for currently running agents and recently completed runs. Each card: agent name, trigger, elapsed time, current node, live cost accumulation, cancel action.
2. Running cards wrap in `Shimmer` and carry an `EmberEdge` reflecting progress. This is the primary place users encounter the AI-as-light language.
3. **SSE live updates** — `/api/live` streams run events. Events patch the TanStack Query cache directly rather than invalidating, so updates never cause a visible refetch flash.
4. Reconnect with exponential backoff; a subtle offline indicator while disconnected; automatic catch-up on reconnect with no duplicated cards.
5. **New-item motion** — a new priority item or in-flight card slides in from the top with a 400ms `--blue-bg` wash that fades. Noticeable, not distracting. Resolved items collapse rather than fade.
6. **Metrics strip** — four numbers: runs today, success rate, spend this week, active agents. Count-up on first mount only, 900ms, tabular numerals. Sparkline each. Static data from rollups — no interactive charts in this slice.
7. **Activity rail** — right column, recent workspace events, grouped by entity rather than by time.

## Out of scope

No customizable dashboard layout. No drag-resize widgets. No drill-down. No interactive charts or filters. No widget marketplace.

## Files

```
features/today/inflight/{zone.tsx,run-card.tsx,cancel.ts}
features/today/metrics/{strip.tsx,metric.tsx,sparkline.tsx}
features/today/activity/{rail.tsx,group.ts}
features/today/live/{sse-client.ts,cache-patch.ts,reconnect.ts}
app/api/live/route.ts
lib/repos/metrics.ts
```

## Gate

1. Start an agent run from another browser tab — the in-flight card appears on Today within 2 seconds.
2. Live updates patch the cache with no visible refetch flash and no full-list re-render (verify with the React Profiler).
3. Kill the network: offline indicator appears, backoff reconnect fires, on reconnect the state catches up with zero duplicate cards.
4. Cancel from the in-flight card stops the run within 500ms.
5. Count-up animates once on mount and never again on live updates; digits do not shift width.
6. Reduced motion: no shimmer, no count-up, no slide-in — items appear in place.
7. Three concurrent runs render three shimmering cards at 60fps.
8. Activity rail groups 40 events into a readable number of groups, not 40 rows.

## Notes

Cache patching rather than invalidation is what separates this from a page that flickers every few seconds. Write the patch functions carefully; an invalidate call anywhere in the live path defeats the session.

This is the screenshot for the landing page and the pitch deck. Three agents running, the Firing Bar segmented at the top, the priority queue ranked below. Take it once this passes.
