import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getWorkspaceContext } from "@/lib/repos/workspaces";
import { listAgentsForIndex } from "@/lib/repos/agents";
import { PageHeader } from "@/components/patterns/page-header";
import { AgentsTable, type AgentIndexTableRow } from "@/features/agents/index/agents-table";
import { TemplateGallery } from "@/features/agents/templates/gallery";
import { ImportAgentButton } from "@/features/agents/index/import-button";

/**
 * Session spec item 8: the agents index rebuilt for real (it was A6's
 * `StubPage` placeholder before this session). `listAgentsForIndex` is one
 * query with per-row aggregate subqueries backed by this session's own
 * `agent_runs(agent_id, started_at)` index -- gate item 8's "stays
 * responsive with 500 agents" is a property of that query and of
 * `DataTable`'s own virtualization (A5), not of anything this page does.
 */
export default async function AgentsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: workspaceSlug } = await params;

  const session = await getSession();
  if (!session) redirect("/login");

  const context = await getWorkspaceContext(session.userId, workspaceSlug);
  if (!context) redirect("/login?no-workspace=1");

  const rows = await listAgentsForIndex(context.workspace.id);
  const tableRows: AgentIndexTableRow[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    enabled: row.enabled,
    latestVersion: row.latestVersion,
    lastRunStatus: row.lastRunStatus,
    lastRunAt: row.lastRunAt ? row.lastRunAt.toISOString() : null,
    successRate: row.successRate,
    costLast7DaysUsd: row.costLast7DaysUsd,
    ownerName: row.ownerName,
  }));

  return (
    <div className="flex h-full w-full flex-col gap-6 p-6">
      <PageHeader
        title="Agents"
        description="Every agent your team has built — status, latest version, and how it's running."
        actions={
          <div className="flex items-center gap-2">
            <ImportAgentButton workspaceSlug={workspaceSlug} />
            <TemplateGallery workspaceSlug={workspaceSlug} />
          </div>
        }
      />
      <AgentsTable agents={tableRows} workspaceSlug={workspaceSlug} />
    </div>
  );
}
