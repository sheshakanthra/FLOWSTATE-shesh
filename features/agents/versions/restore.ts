import type { AgentGraphPayload } from "@/lib/repos/agents";

/**
 * Session spec item 3's "restore as new draft" / gate item 4: "creates a
 * new draft without destroying history." Deliberately thin -- restoring is
 * just overwriting the live draft column with an old snapshot's graph, and
 * that column (`agents.graph_jsonb`) already has an endpoint
 * (`PATCH /api/agents/[id]`, B3) that does exactly this for the debounced
 * autosave. No new route: reusing it means restore literally cannot touch
 * `agent_versions` (that route's patch schema has no field for it), which
 * is what "without destroying history" rests on structurally, not just by
 * this function's own discipline.
 */
export async function restoreVersionAsDraft(
  agentId: string,
  workspaceSlug: string,
  graph: AgentGraphPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const response = await fetch(`/api/agents/${agentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceSlug, graph }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: data?.error ?? "Couldn't restore this version." };
  }
  return { ok: true };
}
