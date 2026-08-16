import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getWorkspaceContext } from "@/lib/repos/workspaces";
import { getAgentDetail, type AgentGraphPayload } from "@/lib/repos/agents";
import { listVersions } from "@/lib/repos/agent-versions";
import { PageHeader } from "@/components/patterns/page-header";
import { VersionsPanel, type VersionsPanelVersion } from "@/features/agents/versions/panel";
import type { DiffableGraph } from "@/features/agents/versions/diff";

const EMPTY_GRAPH: AgentGraphPayload = { nodes: [], edges: [] };

/** Session spec item 3's version history panel. Both the current draft and
 *  every version's graph are fetched server-side in one pass -- the panel
 *  needs the draft for "diff against current" regardless of which version
 *  a user picks, so there's no reason to re-fetch it per selection. */
export default async function AgentVersionsPage({
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

  const versions = await listVersions(context.workspace.id, agentId);

  const currentDraftGraph = (agent.graph ?? EMPTY_GRAPH) as unknown as DiffableGraph;
  const panelVersions: VersionsPanelVersion[] = versions.map((version) => ({
    id: version.id,
    version: version.version,
    note: version.note,
    createdByName: version.createdByName,
    createdAt: version.createdAt.toISOString(),
    runCount: version.runCount,
    graph: version.graph as unknown as DiffableGraph,
  }));

  return (
    <div className="flex h-full w-full flex-col gap-6 p-6">
      <PageHeader
        title="Version history"
        breadcrumb={[
          { label: "Agents", href: `/w/${workspaceSlug}/agents` },
          { label: agent.name, href: `/w/${workspaceSlug}/agents/${agentId}/build` },
          { label: "Versions" },
        ]}
        description={`Every published version of ${agent.name}.`}
      />
      <div className="min-h-0 flex-1">
        <VersionsPanel
          agentId={agentId}
          agentName={agent.name}
          workspaceSlug={workspaceSlug}
          currentDraftGraph={currentDraftGraph}
          versions={panelVersions}
        />
      </div>
    </div>
  );
}
