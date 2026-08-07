"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "./page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { NAV_ITEMS, type NavItem } from "@/components/shell/nav";

export interface StubPageProps {
  /** One of components/shell/nav.ts's NAV_ITEMS ids — resolves the icon
   *  locally (client-side) rather than taking a LucideIcon prop, since a
   *  component reference can't cross the Server → Client Component boundary
   *  the page.tsx files that render this live on (only plain, serializable
   *  props can). Reusing NAV_ITEMS also keeps this page's icon identical to
   *  its sidebar entry instead of a second, driftable copy. */
  navId: NavItem["id"];
  title: string;
  emptyTitle: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}

/** Shared shape behind every A6 route stub (app/(app)/w/[workspace]/*\/page.tsx)
 *  — PageHeader plus a designed EmptyState with a real, working next action,
 *  not placeholder copy. The action navigates rather than performing the
 *  page's real function, since that function belongs to a later track. */
export function StubPage({ navId, title, emptyTitle, description, actionLabel, actionHref }: StubPageProps) {
  const router = useRouter();
  const icon = NAV_ITEMS.find((item) => item.id === navId)?.icon;
  if (!icon) throw new Error(`StubPage: no NAV_ITEMS entry for navId "${navId}"`);

  return (
    <div className="flex flex-col gap-6 p-section-gap">
      <PageHeader title={title} />
      <EmptyState
        icon={icon}
        title={emptyTitle}
        description={description}
        action={{ label: actionLabel, onClick: () => router.push(actionHref) }}
      />
    </div>
  );
}
