# C2 — Streaming, messages, citations

**Track:** C · Copilot
**Preconditions:** C1 gate passed

## Objective

Conversation that streams, renders well, and never makes an unsourced claim about workspace data.

## Scope

1. **Streaming endpoint** — `POST /api/copilot/stream`, SSE, receives the context envelope, calls Groq through `lib/llm/provider.ts`.
2. **Message list** — virtualized past 60 messages. Markdown rendering with syntax-highlighted code blocks, copy button per block, tables, lists.
3. **Streaming render** — tokens append with a 1px caret. No layout shift as content grows. Scroll pins to bottom unless the user has scrolled up, in which case a "jump to latest" control appears.
4. **Retrieval + citations.** When the copilot answers using workspace data, the server retrieves the relevant records, includes them in the prompt with ids, and instructs the model to cite them. Every factual claim about workspace data renders a `CitationPill` that navigates to the source record.
5. **Unsourced claim handling.** If the model produces a claim about workspace data with no citation, mark it visually and do not present it as verified. Better a visible gap than a confident fabrication.
6. **Spectral hairline** — AI messages carry it at the top. This is its only use in the product.
7. Stop generation. Regenerate. Edit-and-resend a user message, truncating the thread after it.
8. Errors: rate limit, provider down, context too large — each with a specific message and a specific recovery action.
9. Message persistence to `copilot_messages`; threads survive reload.

## Out of scope

No tool calls or actions (C3). No file uploads. No voice.

## Files

```
features/copilot/messages/{list.tsx,message.tsx,markdown.tsx,code-block.tsx,citation-pill.tsx}
features/copilot/composer/{index.tsx,send.ts}
features/copilot/stream/{client.ts,parser.ts}
app/api/copilot/stream/route.ts
features/copilot/lib/{retrieve.ts,prompt.ts}
lib/llm/prompts/copilot.ts
```

## Gate

1. First token renders in under 700ms p95 across 20 test messages.
2. Streaming a 2000-token response causes zero layout shift and stays at 60fps.
3. Ask "which agents failed most this week" — the answer cites specific runs, and clicking a citation navigates to that run's trace.
4. Scroll up mid-stream: auto-scroll stops, "jump to latest" appears, clicking it resumes pinning.
5. Stop generation halts within 200ms and the partial message persists.
6. Edit-and-resend truncates the thread correctly and re-streams.
7. Each of the three error types renders its specific message with a working recovery action.
8. Message list with 200 messages: only visible ones in the DOM.
9. Screen reader announces responses in complete sentences, not per token.
10. Reduced motion: no caret animation, content appears in chunks.

## Notes

The citation requirement is the one that keeps this honest. Retrieval happens server-side and the record ids go into the prompt; the model cites ids, and the client resolves ids to pills. Do not let the model invent citation targets — resolve against the retrieved set and drop anything unmatched.

Announcing streaming text per token makes a screen reader unusable. Buffer to sentence boundaries.
