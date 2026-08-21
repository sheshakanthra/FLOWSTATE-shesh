"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * First real consumer of TanStack Query in this codebase (CLAUDE.md's own
 * stack table names it; D2 is the first session whose live-update model
 * actually needs a query cache to patch). One `QueryClient` per browser
 * tab, created inside `useState`'s lazy initializer so it survives
 * re-renders but is never shared across requests server-side -- the
 * standard App Router pattern for a client-only cache that must not leak
 * between users on the same Node process.
 *
 * `staleTime: Infinity` on every query this app writes (see
 * features/today/live/query-keys.ts's consumers) is deliberate: freshness
 * comes exclusively from `/api/live`'s SSE-driven `setQueryData` calls
 * (features/today/live/cache-patch.ts), never from TanStack Query's own
 * background refetch-on-focus/refetch-on-interval machinery, which would
 * reintroduce exactly the "visible refetch flash" gate item 2 checks for.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: Infinity,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
