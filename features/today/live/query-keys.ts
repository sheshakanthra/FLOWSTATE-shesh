/**
 * One shared set of TanStack Query keys for every Today data source --
 * `cache-patch.ts` and every `useQuery` call (zone.tsx, strip.tsx,
 * rail.tsx, and the priority queue) read/write through these, so a typo'd
 * literal key array can never silently desync a patch from the query it
 * was meant to update.
 */
export const todayQueryKeys = {
  runs: (workspaceSlug: string) => ["today", "runs", workspaceSlug] as const,
  priorities: (workspaceSlug: string) => ["today", "priorities", workspaceSlug] as const,
  activity: (workspaceSlug: string) => ["today", "activity", workspaceSlug] as const,
  metrics: (workspaceSlug: string) => ["today", "metrics", workspaceSlug] as const,
};
