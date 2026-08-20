import type { AgentGraphPayload } from "@/lib/repos/agents";
import type { ToolUndoDescriptor } from "../tools/types";

/**
 * Turns a tool's `ToolUndoDescriptor` (features/copilot/tools/types.ts) into
 * real `undo`/`redo` closures for `lib/undo`'s ring buffer -- the client-side
 * counterpart to each tool's own `commit()`. Kept as one small, kind-keyed
 * dispatcher (same shape as `lib/undo/store.ts` itself) rather than letting
 * every call site that approves a tool call know how to reverse each tool's
 * specific mutation.
 *
 * Every descriptor here carries everything both directions need (e.g.
 * `restore_agent_graph` holds both the previous *and* the next graph) --
 * `undo`/`redo` are pure dispatches over that payload, never a second
 * network round trip to re-derive what changed.
 */

interface ArchiveAgentPayload {
  agentId: string;
  workspaceSlug: string;
}

interface RestoreAgentGraphPayload {
  agentId: string;
  workspaceSlug: string;
  previousGraph: AgentGraphPayload;
  nextGraph: AgentGraphPayload;
}

interface DeleteActivityEventPayload {
  id: string;
  workspaceSlug: string;
  clientName: string;
  subject: string;
  body: string;
}

async function patchAgent(agentId: string, body: Record<string, unknown>): Promise<void> {
  const response = await fetch(`/api/agents/${agentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Couldn't undo -- the agent may have changed since.");
}

export function buildUndoRedo(descriptor: ToolUndoDescriptor): { undo: () => Promise<void>; redo: () => Promise<void> } {
  switch (descriptor.kind) {
    case "archive_agent": {
      const payload = descriptor.payload as ArchiveAgentPayload;
      return {
        undo: () => patchAgent(payload.agentId, { workspaceSlug: payload.workspaceSlug, status: "archived" }),
        redo: () => patchAgent(payload.agentId, { workspaceSlug: payload.workspaceSlug, status: "draft" }),
      };
    }
    case "restore_agent_graph": {
      const payload = descriptor.payload as RestoreAgentGraphPayload;
      return {
        undo: () => patchAgent(payload.agentId, { workspaceSlug: payload.workspaceSlug, graph: payload.previousGraph }),
        redo: () => patchAgent(payload.agentId, { workspaceSlug: payload.workspaceSlug, graph: payload.nextGraph }),
      };
    }
    case "delete_activity_event": {
      const payload = descriptor.payload as DeleteActivityEventPayload;
      return {
        undo: async () => {
          const response = await fetch(`/api/activity/${payload.id}?workspaceSlug=${encodeURIComponent(payload.workspaceSlug)}`, {
            method: "DELETE",
          });
          if (!response.ok) throw new Error("Couldn't undo -- this update may already be gone.");
        },
        redo: async () => {
          const response = await fetch("/api/activity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspaceSlug: payload.workspaceSlug,
              clientName: payload.clientName,
              subject: payload.subject,
              body: payload.body,
            }),
          });
          if (!response.ok) throw new Error("Couldn't redo -- try sending it again.");
        },
      };
    }
    default:
      return {
        undo: async () => {
          throw new Error(`No undo handler registered for "${descriptor.kind}".`);
        },
        redo: async () => {
          throw new Error(`No redo handler registered for "${descriptor.kind}".`);
        },
      };
  }
}
