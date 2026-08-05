# B2 — Node registry & typed connections

**Track:** B · Agent Builder
**Preconditions:** B1 gate passed

## Objective

Real node types with typed ports, and a connection system that makes invalid graphs impossible to draw.

## Scope

1. **Node registry** — a declarative definition per node type: id, label, icon, category, input ports, output ports, config schema (Zod), default config. Adding a node type must mean adding one file, nothing else.
2. **Node types:** `Trigger`, `LLM`, `Tool`, `Condition`, `Loop`, `Memory`, `Knowledge`, `Transform`, `Output`, `HumanInLoop`.
3. **Typed ports.** Port types: `text`, `json`, `document`, `signal`, `any`. A connection is only permitted when types are compatible. `any` accepts everything; everything accepts `any`.
4. **Connection validation with pre-attempt feedback.** While dragging from a port, incompatible targets desaturate to 40%. Hovering an incompatible port shows the reason *before* the drop is attempted, not an error after.
5. Cycle detection — reject connections that would create a cycle, and name the cycle in the message.
6. **Node library panel** — searchable, grouped by category, drag-to-canvas and click-to-insert-at-center. Keyboard accessible.
7. Node visual states: idle, selected, invalid config, disabled. Node header carries the type icon and label; body shows a one-line config summary.
8. Copy/paste/duplicate nodes with `⌘C`/`⌘V`/`⌘D`, preserving config, remapping ids.

## Out of scope

No inspector panel (B3). No config editing UI — nodes show summaries only. No execution. No persistence.

## Files

```
features/agents/nodes/registry.ts
features/agents/nodes/types/{trigger,llm,tool,condition,loop,memory,knowledge,transform,output,human-in-loop}.tsx
features/agents/nodes/{node-shell.tsx,port.tsx}
features/agents/lib/{validation.ts,cycle-detect.ts,port-types.ts}
features/agents/library/{index.tsx,search.ts}
```

## Gate

1. All ten node types render with correct ports and are insertable from the library.
2. Connecting `text` → `document` is impossible; the reason appears on hover before any drop is attempted.
3. A connection that would create a cycle is rejected with the cycle's node names in the message.
4. Copy/paste of a 5-node selection preserves config and creates new ids with no collisions.
5. Node library search finds a node by label, category, and description.
6. **Keyboard connection path works:** `Tab` between nodes, `Enter` to focus a node's ports, `c` to begin a connection, arrows to choose a target, `Enter` to complete, `Esc` to cancel. Build this now — retrofitting keyboard support onto a drag system is far harder.
7. Registry test: adding a new node type requires touching exactly one file.
8. 300-node benchmark from B1 still passes with real node types.

## Notes

The port type system is small and worth designing carefully — five types, one compatibility function. Resist adding a sixth type to solve a specific node's problem; use `any` and validate in config instead.

Desaturating invalid targets during drag is the interaction that makes this feel engineered rather than configured. Don't cut it.
