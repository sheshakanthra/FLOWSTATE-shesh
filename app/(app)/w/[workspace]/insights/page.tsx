import { StubPage } from "@/components/patterns/stub-page";

export default async function InsightsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  return (
    <StubPage
      navId="insights"
      title="Insights"
      emptyTitle="No insights yet"
      description="Usage, cost, and performance trends across every agent and client will surface here."
      actionLabel="Back to Today"
      actionHref={`/w/${workspace}/today`}
    />
  );
}
