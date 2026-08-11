"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { ResizablePanel } from "@/components/ui/resizable-panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AgentDetailRecord } from "@/lib/repos/agents";
import { useCanvasStore } from "../store/canvas-store";
import { useGraphStore } from "../store/graph-store";
import { getNodeType } from "../nodes/registry";
import { flushCoalescedEdit } from "../lib/graph-undo";
import { useAutosave, type SaveStatus } from "../lib/persist";
import { SchemaForm } from "./schema-form";
import { AgentSettings } from "./agent-settings";

export interface InspectorProps {
  agent: Pick<AgentDetailRecord, "name" | "description" | "status">;
  agentId: string;
  workspaceSlug: string;
}

function SaveIndicator({
  status,
  lastSavedAt,
  retry,
}: {
  status: SaveStatus;
  lastSavedAt: number | null;
  retry: () => void;
}) {
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-meta text-fg-200">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        Saving…
      </span>
    );
  }
  if (status === "error") {
    return (
      <button type="button" onClick={retry} className="flex items-center gap-1.5 text-meta text-red-fg hover:underline">
        <AlertCircle className="size-3.5" aria-hidden="true" />
        Couldn't save — Retry
      </button>
    );
  }
  if (status === "saved") {
    return (
      <span className="flex items-center gap-1.5 text-meta text-emerald-fg">
        <CheckCircle2 className="size-3.5" aria-hidden="true" />
        {lastSavedAt ? `Saved at ${new Date(lastSavedAt).toLocaleTimeString()}` : "Saved"}
      </span>
    );
  }
  return <span className="text-meta text-fg-200">Unsaved changes</span>;
}

/**
 * The right-side panel (session spec item 1): routes on the current
 * selection (nothing selected -> agent-level settings; one or more
 * same-type nodes -> a schema-driven form; mixed types -> a short
 * explanatory message rather than a broken/partial form) and hosts the
 * save-status indicator for the graph autosave that runs underneath it
 * regardless of what's selected.
 */
export function Inspector({ agent, agentId, workspaceSlug }: InspectorProps) {
  const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);
  const nodes = useGraphStore((state) => state.nodes);
  const autosave = useAutosave(agentId, workspaceSlug);

  // A pending coalesced field edit (mid-300ms-idle-window) must resolve into
  // an undo step before the selection it belongs to disappears -- otherwise
  // switching nodes mid-edit could strand it, or let an edit to the *next*
  // node's same-named field merge into it.
  React.useEffect(() => {
    return () => flushCoalescedEdit();
  }, [selectedNodeIds]);

  const selectedNodes = React.useMemo(
    () => nodes.filter((node) => selectedNodeIds.includes(node.id)),
    [nodes, selectedNodeIds],
  );

  let body: React.ReactNode;
  if (selectedNodes.length === 0) {
    body = <AgentSettings agent={agent} agentId={agentId} workspaceSlug={workspaceSlug} />;
  } else {
    const distinctTypes = new Set(selectedNodes.map((node) => node.type));
    if (distinctTypes.size > 1) {
      body = (
        <div className="flex flex-col gap-2">
          <p className="text-body text-fg-000">{selectedNodes.length} nodes selected.</p>
          <p className="text-meta text-fg-200">
            These nodes are different types. Select nodes of the same type to edit their shared properties together.
          </p>
        </div>
      );
    } else {
      const definition = selectedNodes[0]?.type ? getNodeType(selectedNodes[0].type) : undefined;
      body = definition ? <SchemaForm nodes={selectedNodes} definition={definition} /> : null;
    }
  }

  return (
    <ResizablePanel
      id="agent-inspector"
      edge="right"
      defaultSize={320}
      min={260}
      max={480}
      handleLabel="Resize inspector panel"
      className="flex h-full flex-col border-l border-ink-400 bg-ink-100"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-ink-400/60 px-4 py-3">
        <h2 className="text-label font-medium text-fg-000">Inspector</h2>
        <SaveIndicator status={autosave.status} lastSavedAt={autosave.lastSavedAt} retry={autosave.retry} />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">{body}</div>
      </ScrollArea>
    </ResizablePanel>
  );
}
