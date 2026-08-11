"use client";

import { SplitPane } from "@/components/ui/split-pane";
import { Canvas } from "./canvas";
import { Inspector } from "./inspector";
import { TestConsole } from "./console";
import type { CanvasEdge, CanvasNode } from "./store/graph-store";
import type { AgentDetailRecord } from "@/lib/repos/agents";

export interface AgentBuilderProps {
  agent: Pick<AgentDetailRecord, "name" | "description" | "status">;
  agentId: string;
  workspaceSlug: string;
  initialGraph: { nodes: CanvasNode[]; edges: CanvasEdge[] } | null;
  initialViewport: { x: number; y: number; zoom: number } | null;
}

/** Composes the canvas+inspector (B3) with the bottom test console (B4) --
 *  a `SplitPane` rather than the plain flex row this was in B3, since the
 *  spec's own wording ("bottom SplitPane") names the primitive directly.
 *  `SplitPane`'s `primary` pane is always the size-persisted, top one (see
 *  its own doc comment) -- the canvas+inspector row is `primary` here so
 *  the console lands at the bottom as `secondary`, even though the console
 *  is the pane a user more naturally thinks of as "the one I'm resizing." */
export function AgentBuilder({ agent, agentId, workspaceSlug, initialGraph, initialViewport }: AgentBuilderProps) {
  return (
    <SplitPane
      id="agent-builder-console"
      orientation="vertical"
      defaultSize={560}
      min={240}
      max={900}
      handleLabel="Resize test console"
      primary={
        <div className="flex h-full w-full">
          <div className="min-w-0 flex-1">
            <Canvas initialGraph={initialGraph ?? undefined} initialViewport={initialViewport ?? undefined} />
          </div>
          <Inspector agent={agent} agentId={agentId} workspaceSlug={workspaceSlug} />
        </div>
      }
      secondary={<TestConsole agentId={agentId} workspaceSlug={workspaceSlug} />}
    />
  );
}
