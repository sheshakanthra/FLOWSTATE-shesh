import { eq } from "drizzle-orm";
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
