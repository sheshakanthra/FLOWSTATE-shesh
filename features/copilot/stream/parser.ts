export interface ParsedSSEEvent {
  event: string;
  data: string;
}

/**
 * Incremental SSE parser. A `fetch()` body read can split a frame anywhere,
 * including mid-line -- the same reason B4's NDJSON reader
 * (app/api/agents/[id]/run/route.ts's client) buffers across chunks -- so
 * this buffers raw text across `push()` calls and only emits a block once a
 * full blank-line-terminated frame has arrived.
 *
 * Matches exactly what app/api/copilot/stream/route.ts writes: an `event:`
 * line naming the frame, a `data:` line carrying its JSON payload, blocks
 * separated by `\n\n`.
 */
export class SSEParser {
  private buffer = "";

  push(chunk: string): ParsedSSEEvent[] {
    this.buffer += chunk;
    const blocks = this.buffer.split("\n\n");
    this.buffer = blocks.pop() ?? "";
    return blocks.map(parseBlock).filter((event): event is ParsedSSEEvent => event !== null);
  }
}

function parseBlock(block: string): ParsedSSEEvent | null {
  let event = "message";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice("event:".length).trim();
    else if (line.startsWith("data:")) data = line.slice("data:".length).trim();
  }
  return data ? { event, data } : null;
}
