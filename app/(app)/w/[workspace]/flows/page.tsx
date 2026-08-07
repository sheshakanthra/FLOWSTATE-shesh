import { StubPage } from "@/components/patterns/stub-page";

export default async function FlowsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  return (
    <StubPage
      navId="flows"
      title="Flows"
      emptyTitle="No automations yet"
      description="Scheduled and triggered automations across your clients' tools will show up here."
      actionLabel="Back to Today"
      actionHref={`/w/${workspace}/today`}
    />
  );
}
