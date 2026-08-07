import { StubPage } from "@/components/patterns/stub-page";

export default async function AgentsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  return (
    <StubPage
      navId="agents"
      title="Agents"
      emptyTitle="No agents open yet"
      description="Agents your team builds — their status, latest runs, and cost — will live here."
      actionLabel="Back to Today"
      actionHref={`/w/${workspace}/today`}
    />
  );
}
