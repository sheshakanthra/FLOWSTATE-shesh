# B4 — Run engine & test console

**Track:** B · Agent Builder
**Preconditions:** B3 gate passed

## Objective

Actually execute a graph, record every step in enough detail that B5 can replay it.

## Scope

1. **Execution engine** — topological walk of the graph, node executors per type, variable resolution between nodes, error handling with per-node retry policy.
2. **Step recording.** Every node execution writes a `run_steps` row: node id, started/ended timestamps, resolved input, output, token counts, cost in cents, latency, status, error. This recording format is the contract B5 depends on — design it deliberately.
3. LLM node calls Groq through `lib/llm/provider.ts`. No `groq-sdk` import in this feature.
4. **Test console** — bottom `SplitPane`. Input form derived from the trigger node's schema, run button, live step log streaming as execution proceeds, final output panel, cost and latency summary.
5. **Live canvas feedback during a run:** the executing node wraps in `Shimmer`, its outgoing edge shows a traveling pulse, completed nodes get an emerald hairline, failed nodes get red. Registered with the `FiringBar`.
6. Streaming: LLM node output streams into the step log token by token.
7. Cancel a running execution; in-flight LLM calls abort.
8. Error states: a failed node halts downstream execution, marks dependents as skipped, and surfaces the error with the failing node's resolved input attached.

## Out of scope

No trace replay UI (B5). No scheduling or triggers firing from outside. No versioning.

## Files

```
features/agents/engine/{executor.ts,node-executors/*.ts,scope-resolver.ts,retry.ts}
features/agents/console/{index.tsx,input-form.tsx,step-log.tsx,output-panel.tsx,cost-summary.tsx}
app/api/agents/[id]/run/route.ts   (streaming)
lib/repos/runs.ts
lib/llm/{provider.ts,groq.ts,models.ts}
```

## Gate

1. A seeded 6-node agent runs end to end and produces real output from Groq.
2. Every node produces a `run_steps` row with input, output, tokens, cost, latency, status — verified by querying the DB after a run, not by trusting the UI.
3. Streaming: first token appears in the step log in under 1.5s.
4. Canvas feedback fires correctly: shimmer on the active node, edge pulse, emerald on complete, red on failure.
5. A deliberately broken node fails, halts downstream, marks dependents skipped, and shows the error with its resolved input.
6. Cancel mid-run aborts the in-flight LLM call within 500ms and marks the run cancelled.
7. Cost summary is within 5% of Groq's reported usage for the run.
8. Run appears in the `FiringBar` while executing and clears on completion.

## Notes

The `run_steps` schema is the most consequential thing in this session. B5 replays from it, and if it lacks resolved inputs or precise timestamps, replay will be approximate — which defeats the point. Record more than you think you need.

Node executors should be pure functions of `(config, resolvedInput, ctx)`. Keep side effects in the orchestrator so executors stay unit-testable without a database.
