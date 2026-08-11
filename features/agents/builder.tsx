"use client";

import { Canvas } from "./canvas";
import { Inspector } from "./inspector";
import type { CanvasEdge, CanvasNode } from "./store/graph-store";
import type { AgentDetailRecord } from "@/lib/repos/agents";

export interface AgentBuilderProps {
  agent: Pick<AgentDetailRecord, "name" | "description" | "status">;
  agentId: string;
  workspaceSlug: string;
  initialGraph: { nodes: CanvasNode[]; edges: CanvasEdge[] } | null;
  initialViewport: { x: number; y: number; zoom: number } | null;
}

/** Composes the canvas and the inspector side by side -- the whole B3
 *  surface. A thin wrapper rather than folding this into page.tsx directly
 *  so the server page stays a plain data-fetching Server Component and this
 *  one file owns "what does the build screen actually look like." */
export function AgentBuilder({ agent, agentId, workspaceSlug, initialGraph, initialViewport }: AgentBuilderProps) {
  return (
    <div className="flex h-full w-full">
      <div className="min-w-0 flex-1">
        <Canvas
          initialGraph={initialGraph ?? undefined}
          initialViewport={initialViewport ?? undefined}
        />
      </div>
      <Inspector agent={agent} agentId={agentId} workspaceSlug={workspaceSlug} />
    </div>
  );
}
