"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, GitCompare, History, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { formatTimestamp } from "../lib/format";
import { VersionDiff, VersionView, type DiffableGraph } from "./diff";
import { restoreVersionAsDraft } from "./restore";

export interface VersionsPanelVersion {
  id: string;
  version: number;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
  runCount: number;
  graph: DiffableGraph;
}

export interface VersionsPanelProps {
  agentId: string;
  workspaceSlug: string;
  currentDraftGraph: DiffableGraph;
  versions: VersionsPanelVersion[];
}

type DetailMode = { kind: "none" } | { kind: "view"; versionId: string } | { kind: "diff"; versionId: string };

/**
 * Session spec item 3: the version history panel -- author/date/note/run
 * count per row, with View / Diff against current / Restore as new draft
 * actions. One page (`versions/page.tsx`), this component owning which
 * version (if any) is selected and in which mode, since a Server Component
 * can't hold that interactive state itself (same "client wiring the spec's
 * file list doesn't separately name" precedent as B3's `AgentBuilder` and
 * B5's `RunsTable`).
 */
export function VersionsPanel({ agentId, workspaceSlug, currentDraftGraph, versions }: VersionsPanelProps) {
  const router = useRouter();
  const [detail, setDetail] = React.useState<DetailMode>({ kind: "none" });
  const [restoringId, setRestoringId] = React.useState<string | null>(null);

  const selectedVersion = detail.kind === "none" ? null : versions.find((v) => v.id === detail.versionId);

  async function handleRestore(version: VersionsPanelVersion) {
    setRestoringId(version.id);
    try {
      const result = await restoreVersionAsDraft(agentId, workspaceSlug, version.graph);
      if (!result.ok) {
        toast({ title: "Couldn't restore", description: result.error, variant: "danger" });
        return;
      }
      toast({ title: "Restored", description: `Version ${version.version} is now your draft.` });
      router.push(`/w/${workspaceSlug}/agents/${agentId}/build`);
    } finally {
      setRestoringId(null);
    }
  }

  if (versions.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No versions published yet"
        description="Publish this agent from the builder to create its first version."
        action={{ label: "Back to builder", onClick: () => router.push(`/w/${workspaceSlug}/agents/${agentId}/build`) }}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4">
      <ol className="flex flex-col gap-2">
        {versions.map((version) => (
          <li
            key={version.id}
            data-version-id={version.id}
            className="flex items-center gap-3 rounded-md border border-ink-400 bg-ink-100 px-3 py-2.5"
          >
            <Badge variant="blue">v{version.version}</Badge>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center gap-2 text-meta text-fg-100">
                <span>{version.createdByName ?? "Unknown"}</span>
                <span aria-hidden="true">·</span>
                <span>{formatTimestamp(new Date(version.createdAt))}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {version.runCount} run{version.runCount === 1 ? "" : "s"}
                </span>
              </div>
              {version.note ? <p className="truncate text-body text-fg-000">{version.note}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={detail.kind === "view" && detail.versionId === version.id}
                onClick={() => setDetail({ kind: "view", versionId: version.id })}
              >
                <Eye className="size-3.5" aria-hidden="true" />
                View
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={detail.kind === "diff" && detail.versionId === version.id}
                onClick={() => setDetail({ kind: "diff", versionId: version.id })}
              >
                <GitCompare className="size-3.5" aria-hidden="true" />
                Diff against current
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleRestore(version)}
                loading={restoringId === version.id}
                disabled={restoringId !== null}
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Restore as new draft
              </Button>
            </div>
          </li>
        ))}
      </ol>

      {detail.kind !== "none" && selectedVersion ? (
        <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-ink-400">
          {detail.kind === "view" ? (
            <VersionView graph={selectedVersion.graph} />
          ) : (
            <VersionDiff base={selectedVersion.graph} compare={currentDraftGraph} />
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-md border border-dashed border-ink-400 text-meta text-fg-200">
          Select "View" or "Diff against current" on a version above.
        </div>
      )}
    </div>
  );
}
