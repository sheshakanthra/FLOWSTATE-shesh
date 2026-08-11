import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getWorkspaceContext } from "@/lib/repos/workspaces";
import { getAgentDetail } from "@/lib/repos/agents";
import { AgentBuilder } from "@/features/agents/builder";
import type { CanvasEdge, CanvasNode } from "@/features/agents/store/graph-store";

/**
 * B3: the agent's persisted graph (`agents.graph_jsonb`/`viewport_jsonb`)
 * is loaded server-side and handed to the client-only AgentBuilder, which
 * hydrates the canvas/inspector stores from it -- gate item 6, "reloading
 * the page restores the graph exactly." Workspace membership is already
 * enforced by the (app)/w/[workspace] layout above this route, but that
 * doesn't hand its resolved WorkspaceContext down to this page (Server
 * Components each fetch what they need), so it's re-resolved here the same
 * way every other per-page data fetch in this app does.
 */
export default async function AgentBuildPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>;
}) {
  const { workspace: workspaceSlug, id: agentId } = await params;

  const session = await getSession();
  if (!session) redirect("/login");

  const context = await getWorkspaceContext(session.userId, workspaceSlug);
  if (!context) redirect("/login?no-workspace=1");

  const agent = await getAgentDetail(context.workspace.id, agentId);
  if (!agent) notFound();

  return (
    <div className="h-full w-full">
      <AgentBuilder
        agent={{ name: agent.name, description: agent.description, status: agent.status }}
        agentId={agent.id}
        workspaceSlug={workspaceSlug}
        initialGraph={agent.graph as { nodes: CanvasNode[]; edges: CanvasEdge[] } | null}
        initialViewport={agent.viewport}
      />
    </div>
  );
}
