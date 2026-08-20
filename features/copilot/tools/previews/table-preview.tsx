"use client";

import Link from "next/link";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { SearchRunsRow } from "../definitions/search-runs";

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  succeeded: "emerald",
  failed: "red",
  cancelled: "amber",
  running: "blue",
};

/** `search_runs`'s preview -- a real, small `<table>`, not a virtualized
 *  `DataTable`: the tool caps results at 25 rows well under the "every list
 *  over 50 items is virtualized" threshold, and this card sits inside the
 *  narrow copilot dock, not a full page. */
export function TablePreview({ rows }: { rows: SearchRunsRow[] }) {
  if (rows.length === 0) {
    return <p className="text-meta text-fg-200">No matching runs.</p>;
  }

  return (
    <div className="max-h-72 overflow-auto rounded-sm border border-ink-400">
      <table className="w-full text-left text-meta">
        <thead className="sticky top-0 border-b border-ink-400 bg-ink-200 text-fg-100">
          <tr>
            <th className="px-2 py-1.5 font-medium">Agent</th>
            <th className="px-2 py-1.5 font-medium">Status</th>
            <th className="px-2 py-1.5 font-medium">Started</th>
            <th className="px-2 py-1.5 font-medium">Cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-ink-400 last:border-0">
              <td className="max-w-40 truncate px-2 py-1.5">
                <Link href={row.href} className="text-fg-000 underline-offset-2 hover:underline">
                  {row.agentName}
                </Link>
              </td>
              <td className="px-2 py-1.5">
                <Badge variant={STATUS_VARIANT[row.status] ?? "neutral"}>{row.status}</Badge>
              </td>
              <td className="px-2 py-1.5 whitespace-nowrap text-fg-100">{new Date(row.startedAt).toLocaleString()}</td>
              <td className="px-2 py-1.5 whitespace-nowrap text-fg-100">{row.costUsd !== null ? `$${row.costUsd.toFixed(4)}` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
