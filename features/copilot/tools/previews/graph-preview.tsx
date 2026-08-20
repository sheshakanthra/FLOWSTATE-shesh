"use client";

import { VersionView, type DiffableGraph } from "@/features/agents/versions/diff";

/**
 * `create_agent_from_description`'s preview -- "a rendered canvas" (spec
 * item 4), not a diff (that's `DiffPreview`, below): reuses B6's read-only
 * `VersionView` verbatim (its own `ReactFlowProvider`, never the live
 * builder's stores) rather than a second canvas renderer for what would
 * otherwise be a near-identical file.
 */
export function GraphPreview({ graph }: { graph: DiffableGraph }) {
  return (
    <div className="h-56 w-full overflow-hidden rounded-sm border border-ink-400 bg-ink-050">
      <VersionView graph={graph} />
    </div>
  );
}
