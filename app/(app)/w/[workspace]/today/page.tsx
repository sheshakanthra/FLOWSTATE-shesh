import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getWorkspaceContext, listMembers } from "@/lib/repos/workspaces";
import { getUserById } from "@/lib/repos/users";
import { listPriorityItems } from "@/lib/repos/priorities";
import { PageHeader } from "@/components/patterns/page-header";
import { TemplateGallery } from "@/features/agents/templates/gallery";
import { PriorityQueue } from "@/features/today/priority/queue";
import type { PriorityItemClient } from "@/features/today/priority/store";

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
 * Session spec item 8: PageHeader, a greeting with the user's name and
 * date, and a quick-create action -- `TemplateGallery` (B6) already is
 * exactly that action ("New agent" → pick a template → creates a real
 * draft agent), reused here rather than a second create-agent surface.
 *
 * Priority items are fetched once, here, via `listPriorityItems`'s single
 * indexed query -- the real data behind gate item 3's "full paint under
 * 800ms with 500 priority items": the queue's first render is this page's
 * own server-rendered HTML, not a client-side fetch-then-render.
 */
export default async function TodayPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: workspaceSlug } = await params;

  const session = await getSession();
  if (!session) redirect("/login");

  const context = await getWorkspaceContext(session.userId, workspaceSlug);
  if (!context) redirect("/login?no-workspace=1");

  const [user, items, members] = await Promise.all([
    getUserById(session.userId),
    listPriorityItems(context.workspace.id),
    listMembers(context.workspace.id),
  ]);
  if (!user) redirect("/login");

  const now = new Date();
  const firstName = user.name.split(" ")[0] ?? user.name;

  const initialItems: PriorityItemClient[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    severity: item.severity,
    itemType: item.itemType,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    assigneeId: item.assigneeId,
    assigneeName: item.assigneeName,
    resolved: item.resolved,
    magnitude: item.magnitude,
    entitySignal: item.entitySignal,
    snoozedUntil: item.snoozedUntil ? item.snoozedUntil.toISOString() : null,
    createdAt: item.createdAt.toISOString(),
  }));

  return (
    <div className="flex h-full w-full flex-col gap-6 p-6">
      <PageHeader
        title={`${greetingForHour(now.getHours())}, ${firstName}`}
        description={formatLongDate(now)}
        actions={<TemplateGallery workspaceSlug={workspaceSlug} />}
      />
      <PriorityQueue workspaceSlug={workspaceSlug} members={members} initialItems={initialItems} />
    </div>
  );
}
