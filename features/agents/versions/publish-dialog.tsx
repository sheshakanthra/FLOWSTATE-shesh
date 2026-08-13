"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { estimateCostCents } from "@/lib/llm/models";
import type { LlmConfig } from "../nodes/types/llm";
import { useCanvasStore } from "../store/canvas-store";
import { useGraphStore } from "../store/graph-store";
import { validateGraph, type ValidatableEdge, type ValidatableNode } from "../lib/validate-graph";

/** A rough, clearly-labeled estimate, not a promise -- there's no real run
 *  history to average for a never-run draft, and even a published agent's
 *  actual token counts vary run to run with real input. Assumes each LLM
 *  node in the graph runs once per overall run, at a flat assumed token
 *  count representative of this app's own real measured runs (B4/B5: a
 *  short system-prompt-only call landed around 70-90 prompt tokens and
 *  20-30 completion tokens against real Groq). */
const ASSUMED_PROMPT_TOKENS = 400;
const ASSUMED_COMPLETION_TOKENS = 150;

function estimateCostPerRunCents(nodes: ValidatableNode[]): number {
  let total = 0;
  for (const node of nodes) {
    if (node.type !== "llm") continue;
    const config = node.data.config as Partial<LlmConfig>;
    if (!config.model) continue;
    total += estimateCostCents(config.model, ASSUMED_PROMPT_TOKENS, ASSUMED_COMPLETION_TOKENS);
  }
  return total;
}

function formatCents(cents: number): string {
  if (cents === 0) return "0¢";
  if (cents < 1) return `~${cents.toFixed(4)}¢`;
  return `~${cents.toFixed(2)}¢`;
}

export interface PublishDialogProps {
  agentId: string;
  workspaceSlug: string;
  isFirstPublish: boolean;
  onPublished: () => void;
}

/**
 * Session spec item 5: a pre-publish summary (node count, estimated cost,
 * validation) with publishing blocked while validation fails and every
 * failing node clickable to focus it. Reads the live draft directly from
 * `graph-store` (no fetch needed -- this dialog only ever opens from
 * inside the builder, where that store is already the source of truth),
 * and runs the *exact* `validateGraph` the publish route re-checks
 * server-side, so what this dialog shows is never a UI-only guess about
 * whether the route will accept the request.
 */
export function PublishDialog({ agentId, workspaceSlug, isFirstPublish, onPublished }: PublishDialogProps) {
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [publishing, setPublishing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const issues = React.useMemo(
    () => validateGraph(nodes as unknown as ValidatableNode[], edges as ValidatableEdge[]),
    [nodes, edges],
  );
  const estimatedCostCents = React.useMemo(
    () => estimateCostPerRunCents(nodes as unknown as ValidatableNode[]),
    [nodes],
  );

  function focusNode(nodeId: string | null) {
    if (!nodeId) return;
    useGraphStore.getState().setSelection([nodeId], []);
    useCanvasStore.getState().setSelectedNodeIds([nodeId]);
    setOpen(false);
  }

  async function handlePublish() {
    setPublishing(true);
    setError(null);
    try {
      const response = await fetch(`/api/agents/${agentId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug, note: note.trim() || undefined }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Couldn't publish this agent. Try again.");
        return;
      }
      const data = (await response.json()) as { version: { version: number } };
      setOpen(false);
      setNote("");
      toast({ title: "Published", description: `Version ${data.version.version} is now live.` });
      onPublished();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Rocket className="size-3.5" aria-hidden="true" />
          Publish
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isFirstPublish ? "Publish this agent" : "Publish a new version"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4 rounded-md border border-ink-400 bg-ink-100 px-3 py-2 text-meta text-fg-100">
            <span>
              <strong className="text-fg-000">{nodes.length}</strong> node{nodes.length === 1 ? "" : "s"}
            </span>
            <span>
              Estimated cost per run: <strong className="text-fg-000">{formatCents(estimatedCostCents)}</strong>
            </span>
          </div>

          {issues.length === 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-emerald-line bg-emerald-bg px-3 py-2 text-meta text-emerald-fg">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
              Ready to publish.
            </div>
          ) : (
            <div className="flex flex-col gap-2 rounded-md border border-red-line bg-red-bg px-3 py-2">
              <div className="flex items-center gap-2 text-meta font-medium text-red-fg">
                <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                Fix these before publishing:
              </div>
              <ul className="flex flex-col gap-1">
                {issues.map((issue, index) => (
                  <li key={index}>
                    {issue.nodeId ? (
                      <button
                        type="button"
                        onClick={() => focusNode(issue.nodeId)}
                        className="text-left text-meta text-red-fg underline decoration-red-fg/50 underline-offset-2 hover:decoration-red-fg"
                      >
                        {issue.message}
                      </button>
                    ) : (
                      <span className="text-meta text-red-fg">{issue.message}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <FormField label="Note" description="Optional — shown in the version history.">
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="What changed in this version?"
            />
          </FormField>

          {error ? <p className="text-meta text-red-fg">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handlePublish} disabled={issues.length > 0} loading={publishing}>
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
