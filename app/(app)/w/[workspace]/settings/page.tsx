import { StubPage } from "@/components/patterns/stub-page";

export default async function SettingsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  return (
    <StubPage
      navId="settings"
      title="Settings"
      emptyTitle="Workspace settings aren't built yet"
      description="Billing, roles, and integrations will live here. An owner can rename the workspace from the switcher in the sidebar for now."
      actionLabel="Back to Today"
      actionHref={`/w/${workspace}/today`}
    />
  );
}
