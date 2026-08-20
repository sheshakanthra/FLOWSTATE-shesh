"use client";

import { VersionDiff, type DiffableGraph } from "@/features/agents/versions/diff";

/**
 * `modify_agent`'s preview -- "a genuine canvas diff, not serialized JSON"
 * (gate item 3). Reuses B6's `VersionDiff` verbatim: added/removed/modified
 * node highlighting and the changes side-list both come for free from
 * `diffGraphs`, the same function the version-history panel's own "diff
 * against current" action already uses.
 */
export function DiffPreview({ base, compare }: { base: DiffableGraph; compare: DiffableGraph }) {
  return (
    <div className="h-72 w-full overflow-hidden rounded-sm border border-ink-400 bg-ink-050">
      <VersionDiff base={base} compare={compare} />
    </div>
  );
}
