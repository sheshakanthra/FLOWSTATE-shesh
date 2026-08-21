/**
 * Gate item 4: cancel from the in-flight card stops the run within 500ms.
 * Posts to the real cross-tab cancel endpoint (app/api/agents/[id]/run/[runId]/cancel/route.ts) --
 * this card's own connection is `/api/live`'s SSE stream, not the run's
 * NDJSON stream (which belongs to whichever tab/request actually started
 * it), so there is no local `AbortController` this call could reach for
 * instead.
 */
export async function cancelRun(workspaceSlug: string, agentId: string, runId: string): Promise<void> {
  const response = await fetch(`/api/agents/${agentId}/runs/${runId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceSlug }),
  });
  if (!response.ok) {
    throw new Error("The cancel request failed.");
  }
}
