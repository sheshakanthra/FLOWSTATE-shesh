import { StubPage } from "@/components/patterns/stub-page";

export default async function KnowledgePage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  return (
    <StubPage
      navId="knowledge"
      title="Knowledge"
      emptyTitle="No knowledge sources yet"
      description="Documents, transcripts, and reference material your agents draw on will be indexed here."
      actionLabel="Back to Today"
      actionHref={`/w/${workspace}/today`}
    />
  );
}
