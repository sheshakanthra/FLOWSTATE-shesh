# D1 — Priority queue & ranking

**Track:** D · Today
**Preconditions:** C3 gate passed

## Objective

The first screen anyone sees, built around a ranked list of what needs a human — not a wall of KPI cards.

## Scope

1. **Priority queue** — ranked list of items needing action. For this slice, item types are: failed agent run, agent awaiting human-in-loop approval, agent with a declining success rate, unpublished draft with changes older than 7 days, cost spike on an agent.
2. **Ranking function** — `score = blastRadius × timeDecay × entityValue`, pure and unit-testable in `features/today/lib/rank.ts`. Weights in one exported constant.
3. **Score explainer** — hovering a row's rank shows the actual factor values and weights that produced the score. Not a generic sentence. This is the detail that makes the ranking trustworthy.
4. **Inline actions per row** — approve, retry, snooze (1h / tomorrow / next week), delegate, open. All optimistic, all undoable.
5. Row states: normal, urgent (red hairline), snoozed (dimmed with a return time), resolved (collapses out).
6. Keyboard: `j`/`k` navigate, `Enter` opens, `e` resolves, `s` snoozes, `1`–`9` jump to row.
7. Empty state — "Nothing needs you right now" with a genuine suggestion of what to do next, not a checkmark and silence.
8. Page shell: `PageHeader`, greeting with the user's name and date, quick-create action.

## Out of scope

No In-flight zone (D2). No charts. No customizable layout. No item types from features not in this slice — no CRM, project, or invoice items.

## Files

```
features/today/priority/{queue.tsx,row.tsx,score-explainer.tsx,actions.tsx,snooze.tsx}
features/today/lib/{rank.ts,item-types.ts}
app/(app)/w/[workspace]/today/page.tsx
app/api/priorities/route.ts
lib/repos/priorities.ts
```

## Gate

1. Ranking function unit tests cover 20 scenarios including ties, extreme recency, and zero-value entities.
2. Score explainer shows real factor values that multiply to the displayed score — a reviewer can check the arithmetic.
3. Full paint under 800ms with 500 priority items in the workspace.
4. Every inline action is optimistic and reverses correctly on server failure.
5. `⌘Z` undoes a resolve and a snooze.
6. Full keyboard operation; the queue is a proper `listbox` with correct ARIA.
7. Snoozed items return at the correct time and are visually distinct while snoozed.
8. Empty state suggests a specific action, not a generic congratulation.

## Notes

The score explainer is small and disproportionately important. Ranked lists without visible reasoning get ignored within a week because users stop believing the order.

Priority items should be materialized on event rather than computed per request, or the 800ms budget will not survive real data volume.
