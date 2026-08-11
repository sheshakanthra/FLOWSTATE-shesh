import { eq } from "drizzle-orm";
import type { Viewport } from "@xyflow/react";
import { agents } from "@/db/schema";
import { withScope } from "./db";

export interface AgentRecord {
  id: string;
  workspaceId: string;
  name: string;
  status: "draft" | "published" | "failing" | "archived";
}

/**
 * Deliberately filters only on `id`, not `workspaceId` — the workspace
 * isolation comes entirely from RLS (via withScope's `app.workspace_id`
 * session variable), not from an app-level WHERE clause. That's the
 * property db/schema.test.ts's RLS proof exercises: calling this with the
 * *wrong* workspaceId for a real agent id must return null, because the
 * database itself hides the row, not because this function happened to
 * filter it out.
 */
export async function getAgentById(workspaceId: string, agentId: string): Promise<AgentRecord | null> {
  const [agent] = await withScope({ workspaceId }, (tx) =>
    tx
      .select({
        id: agents.id,
        workspaceId: agents.workspaceId,
        name: agents.name,
        status: agents.status,
      })
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1),
  );
  return agent ?? null;
}

/** Minimal shape persisted in `agents.graph_jsonb` -- a plain nodes/edges
 *  pair, not @xyflow/react's own `Node`/`Edge` types directly, since those
 *  carry client-only fields (`selected`, `dragging`) this never needs to
 *  round-trip. `unknown` at rest: features/agents/lib/persist.ts is the one
 *  place that knows the real node/edge shape and validates it on the way in
 *  and out, matching "no business logic in lib/repos" -- this file has no
 *  opinion on what a node looks like. */
export interface AgentGraphPayload {
  nodes: unknown[];
  edges: unknown[];
}

export interface AgentDetailRecord extends AgentRecord {
  description: string | null;
  graph: AgentGraphPayload | null;
  viewport: Viewport | null;
  updatedAt: Date;
}

export async function getAgentDetail(workspaceId: string, agentId: string): Promise<AgentDetailRecord | null> {
  const [agent] = await withScope({ workspaceId }, (tx) =>
    tx
      .select({
        id: agents.id,
        workspaceId: agents.workspaceId,
        name: agents.name,
        description: agents.description,
        status: agents.status,
        graphJsonb: agents.graphJsonb,
        viewportJsonb: agents.viewportJsonb,
        updatedAt: agents.updatedAt,
      })
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1),
  );
  if (!agent) return null;
  return {
    id: agent.id,
    workspaceId: agent.workspaceId,
    name: agent.name,
    description: agent.description,
    status: agent.status,
    graph: (agent.graphJsonb as AgentGraphPayload | null) ?? null,
    viewport: (agent.viewportJsonb as Viewport | null) ?? null,
    updatedAt: agent.updatedAt,
  };
}

export interface AgentUpdatePatch {
  name?: string;
  description?: string;
  graph?: AgentGraphPayload;
  viewport?: Viewport;
}

/** Partial update behind one endpoint (`app/api/agents/[id]/route.ts`) for
 *  both the debounced graph autosave and the Inspector's agent-settings
 *  form -- only the keys present in `patch` are written. Returns null (not
 *  a thrown error) when RLS hides the row, e.g. `agentId` belongs to a
 *  different workspace than `workspaceId` scopes -- the route maps that to
 *  a 404, the same "the database itself hides the row" property
 *  getAgentById's own doc comment describes. */
export async function updateAgent(
  workspaceId: string,
  agentId: string,
  patch: AgentUpdatePatch,
): Promise<{ updatedAt: Date } | null> {
  const values: Partial<typeof agents.$inferInsert> = { updatedAt: new Date() };
  if (patch.name !== undefined) values.name = patch.name;
  if (patch.description !== undefined) values.description = patch.description;
  if (patch.graph !== undefined) values.graphJsonb = patch.graph;
  if (patch.viewport !== undefined) values.viewportJsonb = patch.viewport;

  const [updated] = await withScope({ workspaceId }, (tx) =>
    tx.update(agents).set(values).where(eq(agents.id, agentId)).returning({ updatedAt: agents.updatedAt }),
  );
  return updated ?? null;
}
