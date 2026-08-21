import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getWorkspaceContext, listMembers } from "@/lib/repos/workspaces";
import { getUserById } from "@/lib/repos/users";
import { listPriorityItems } from "@/lib/repos/priorities";
import { getMetricsRollup, listInFlightRuns, listRecentActivity } from "@/lib/repos/metrics";
import { PageHeader } from "@/components/patterns/page-header";
import { TemplateGallery } from "@/features/agents/templates/gallery";
import { TodayShell } from "@/features/today/today-shell";
import { toLiveActivityEvent, toLivePriorityItem, toLiveRun } from "@/features/today/live/serialize";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Hand-built, matching `features/agents/lib/format.ts`'s own precedent for
 *  the exact same reason: `toLocaleDateString()`'s output depends on the
 *  runtime's ICU data, a real, previously-hit source of divergence between
 *  Node's server build and a browser. This page's greeting is rendered
 *  once, server-side, with no client re-render of its own -- kept
 *  hand-built anyway rather than relying on that distinction holding up. */
function formatLongDate(date: Date): string {
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * D1's session spec item 8 (PageHeader, greeting, quick-create) plus D2's
 * own four data sources -- priority items, in-flight runs, metrics, and
 * activity are all fetched once, here, server-side, and handed to
 * `TodayShell` as `initialData`/`initialItems`/etc. seeds. This is what
 * gate item 3's "full paint under 800ms" (D1) and the general "no visible
 * refetch flash" (D2 gate item 2) both rest on: the first paint is this
 * page's own server-rendered HTML, and every client-side query
 * (`TodayShell`'s children) starts already-populated rather than loading.
 */
export default async function TodayPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: workspaceSlug } = await params;

  const session = await getSession();
  if (!session) redirect("/login");

  const context = await getWorkspaceContext(session.userId, workspaceSlug);
  if (!context) redirect("/login?no-workspace=1");
  const workspaceId = context.workspace.id;

  const [user, priorityItems, members, runs, metrics, activity] = await Promise.all([
    getUserById(session.userId),
    listPriorityItems(workspaceId),
    listMembers(workspaceId),
    listInFlightRuns(workspaceId),
    getMetricsRollup(workspaceId),
    listRecentActivity(workspaceId),
  ]);
  if (!user) redirect("/login");

  const now = new Date();
  const firstName = user.name.split(" ")[0] ?? user.name;

  return (
    <div className="flex h-full w-full flex-col gap-6 p-6">
      <PageHeader
        title={`${greetingForHour(now.getHours())}, ${firstName}`}
        description={formatLongDate(now)}
        actions={<TemplateGallery workspaceSlug={workspaceSlug} />}
      />
      <TodayShell
        workspaceSlug={workspaceSlug}
        members={members}
        initialPriorityItems={priorityItems.map(toLivePriorityItem)}
        initialRuns={runs.map(toLiveRun)}
        initialMetrics={metrics}
        initialActivity={activity.map(toLiveActivityEvent)}
      />
    </div>
  );
}
