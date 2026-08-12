import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getWorkspaceContext } from "@/lib/repos/workspaces";
import { getAgentById } from "@/lib/repos/agents";
import { listRuns } from "@/lib/repos/runs";
import { PageHeader } from "@/components/patterns/page-header";
import { RunsTable } from "@/features/agents/runs/table";

/** Session spec item 1: `/agents/[id]/runs` -- the run history table. Runs
 *  are fetched server-side (matching every other page in this app: each
 *  Server Component re-resolves its own session/workspace rather than
 *  relying on a data channel from the (app)/w/[workspace] layout above it,
 *  same as B3's build page) and handed to the client `RunsTable`, which
 *  owns filtering. */
export default async function AgentRunsPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>;
}) {
  const { workspace: workspaceSlug, id: agentId } = await params;

  const session = await getSession();
  if (!session) redirect("/login");

  const context = await getWorkspaceContext(session.userId, workspaceSlug);
  if (!context) redirect("/login?no-workspace=1");

  const agent = await getAgentById(context.workspace.id, agentId);
  if (!agent) notFound();

  const runs = await listRuns(context.workspace.id, agentId);

  return (
    <div className="flex h-full w-full flex-col gap-6 p-6">
      <PageHeader
        title="Run history"
        breadcrumb={[
          { label: "Agents", href: `/w/${workspaceSlug}/agents` },
          { label: agent.name, href: `/w/${workspaceSlug}/agents/${agentId}/build` },
          { label: "Runs" },
        ]}
        description={`Every recorded run of ${agent.name} — open one to scrub its trace.`}
      />
      <RunsTable runs={runs} agentId={agentId} workspaceSlug={workspaceSlug} />
    </div>
  );
}
