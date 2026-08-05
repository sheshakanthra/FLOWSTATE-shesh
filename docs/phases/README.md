# Session specs

Each file is one Claude Code session. One session, one gate, one commit by the human at the end.

## How to run a session

1. `/clear` — always. A carried-over context from the previous session is the main cause of convention drift.
2. Start the session with exactly:

   > Read CLAUDE.md, then PROGRESS.md, then docs/phases/<ID>-<name>.md. Build only what that spec describes. Stop at the gate.

3. When it reports done, run the gate yourself. Do not take its word for it.
4. Review the diff. Look specifically for: color literals, un-virtualized lists, missing keyboard paths, files created outside the spec's file list.
5. Commit manually.
6. `/clear` and move to the next session.

## Track order

Tracks must run in order A → B → C → D → E. Within a track, sessions run in numeric order.

- **A (6 sessions)** — Foundation & design system. Everything downstream is cheap or expensive depending on this. Do not skip ahead.
- **B (6 sessions)** — Agent Builder. The flagship. This is the surface that has to be undeniable.
- **C (3 sessions)** — Copilot core. Proves AI is ambient rather than a chat page.
- **D (2 sessions)** — Today dashboard. The first screen anyone sees.
- **E (1 session)** — Marketing hero. The live demo.

## The design pass

After A5 and again after B5, stop and do a visual review before continuing. These are the two points where the design language either holds or quietly degrades. Fix it there — fixing it at the end means touching every file.
