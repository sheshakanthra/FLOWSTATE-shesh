import { StubPage } from "@/components/patterns/stub-page";

export default async function TodayPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  return (
    <StubPage
      navId="today"
      title="Today"
      emptyTitle="Nothing needs you yet"
      description="Today surfaces failing runs, pending approvals, and client activity the moment agents start working."
      actionLabel="View agents"
      actionHref={`/w/${workspace}/agents`}
    />
  );
}
