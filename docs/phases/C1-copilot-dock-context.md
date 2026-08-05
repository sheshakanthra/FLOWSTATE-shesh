# C1 — Copilot dock & context envelope

**Track:** C · Copilot
**Preconditions:** B6 gate passed

## Objective

The dock, and the thing that makes it more than a chat box: a typed context envelope that knows where the user is and what they've selected.

## Scope

1. **Dock** — three modes: docked right (resizable, default 380px), floating, fullscreen. `⌘J` toggles. Mode and width persist per user. The width slot was reserved in A6, so opening it must cause zero reflow.
2. **Context envelope** — a typed object rebuilt on every navigation and selection change:
   ```ts
   type CopilotContext = {
     route: string;
     entity: { type: 'agent' | 'run' | 'workspace' | null; id: string | null };
     selection: { type: string; ids: string[] } | null;
     filters: Record<string, unknown>;
     dateRange: { from: string; to: string } | null;
     recentActions: { action: string; entity: string; at: string }[];
   };
   ```
   This is structured context, not a page-name string. It is what separates "an AI that answers" from "an AI that already knows."
3. **Context chips** — the composer displays what the copilot currently sees as removable chips ("Agent: Lead Qualifier", "3 runs selected"). The user can drop a chip to exclude it. Context must be visible and editable, never hidden.
4. Context providers: each feature registers its contribution via a `useCopilotContext()` hook with automatic cleanup on unmount. Track B registers agent and run context.
5. Thread list, new thread, thread rename and delete.
6. Empty state: three context-aware suggested prompts based on the current route.

## Out of scope

No streaming yet (C2). No tools or actions (C3). The composer can render but need not send.

## Files

```
features/copilot/dock/{index.tsx,modes.ts,resize.ts}
features/copilot/context/{envelope.ts,provider.tsx,use-copilot-context.ts,chips.tsx}
features/copilot/threads/{list.tsx,store.ts}
lib/repos/copilot.ts
```

## Gate

1. **Context correctness test:** an automated test visits every app route, asserts the envelope shape, and snapshots its contents. 100% of routes produce a valid envelope.
2. Selecting 3 runs in the runs table updates the envelope and shows a chip within one frame.
3. Opening the dock causes zero layout shift — measure CLS, expect 0.
4. Dock mode and width persist across reload.
5. Removing a context chip removes that field from the envelope sent on the next message.
6. Unmounting a feature removes its context contribution — navigating away from an agent clears the agent chip.
7. `⌘J` toggles; focus moves into the composer on open and returns to the prior element on close.
8. Empty state prompts differ between `/today` and an agent build page.

## Notes

Build the context system before the chat. Teams that build the chat first end up passing a page title and calling it context-aware, and the product never recovers from it.

`recentActions` should be capped at the last 10 and sourced from the undo stack labels — they're already human-readable.
