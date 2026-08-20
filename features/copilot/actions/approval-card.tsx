"use client";

import * as React from "react";
import { motion } from "motion/react";
import { AlertTriangle, Check, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Shimmer } from "@/components/motion/shimmer";
import { SpectralHairline } from "@/components/motion/spectral-hairline";
import { useMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { DiffableGraph } from "@/features/agents/versions/diff";
import type { SearchRunsRow } from "../tools/definitions/search-runs";
import { DiffPreview } from "../tools/previews/diff-preview";
import { GraphPreview } from "../tools/previews/graph-preview";
import { TablePreview } from "../tools/previews/table-preview";
import { TextPreview, type TextPreviewData } from "../tools/previews/text-preview";
import type { ToolCallClientState } from "../messages/store";

function humanizeToolName(toolName: string): string {
  return toolName.replace(/_/g, " ");
}

function PreviewBody({ preview }: { preview: NonNullable<ToolCallClientState["preview"]> }) {
  if (preview.kind === "graph") {
    return <GraphPreview graph={(preview.data as { graph: DiffableGraph }).graph} />;
  }
  if (preview.kind === "diff") {
    const data = preview.data as { base: DiffableGraph; compare: DiffableGraph };
    return <DiffPreview base={data.base} compare={data.compare} />;
  }
  if (preview.kind === "table") {
    return <TablePreview rows={(preview.data as { rows: SearchRunsRow[] }).rows} />;
  }
  const data = preview.data as TextPreviewData;
  return <TextPreview text={data.text} meta={data.meta} />;
}

export interface ApprovalCardProps {
  toolCall: ToolCallClientState;
  onApprove: () => void;
  onReject: () => void;
  onRetry: () => void;
}

/**
 * Session spec items 4 & 6, one component: a card that slides up from the
 * composer, shows a spectral hairline while a mutating tool is awaiting
 * approval (the "action preview"), shimmers while anything is executing,
 * and shows the result or a retryable error on completion (the "tool call
 * rendering"). One component rather than two because they're really the
 * same object moving through states -- proposed -> (approved ->) resolved
 * -- not two independent UI elements that happen to appear near each other.
 *
 * Gate item 9: the Approve/Decline buttons' accessible names are built from
 * `preview.summary` ("Approve: Create \"Inbound Lead Qualifier\" (5 nodes)"),
 * never the bare visible label alone -- a screen reader user gets the same
 * "exactly what will change" statement a sighted user reads off the card.
 */
export function ApprovalCard({ toolCall, onApprove, onReject, onRetry }: ApprovalCardProps) {
  const { base, prefersReducedMotion } = useMotion();
  const label = humanizeToolName(toolCall.toolName);

  const enter = prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 };
  const settled = prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 };

  const isAwaitingApproval = toolCall.status === "pending";
  const isRunning = toolCall.status === "running";
  const isFailed = toolCall.status === "failed";

  const body = (
    <div className={cn("flex flex-col gap-2 rounded-md border border-ink-400 bg-ink-100 p-3 shadow-card")}>
      {isAwaitingApproval ? <SpectralHairline /> : null}

      <div className="flex items-center justify-between gap-2">
        <span className="text-label font-medium text-fg-000 capitalize">{label}</span>
        {isRunning ? <span className="text-meta text-fg-200">Working…</span> : null}
      </div>

      {toolCall.preview ? <PreviewBody preview={toolCall.preview} /> : null}

      {isFailed ? (
        <div role="alert" className="flex items-start gap-2 rounded-sm border border-red-line bg-red-bg px-2 py-1.5">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-red-fg" aria-hidden="true" />
          <p className="text-meta text-red-fg">{toolCall.error ?? "This action failed."}</p>
        </div>
      ) : null}

      {isAwaitingApproval && toolCall.preview ? (
        <div className="flex items-center gap-1.5">
          <Button size="sm" onClick={onApprove} aria-label={`Approve: ${toolCall.preview.summary}`}>
            <Check className="size-3.5" aria-hidden="true" />
            Approve
          </Button>
          <Button size="sm" variant="secondary" onClick={onReject} aria-label={`Decline: ${toolCall.preview.summary}`}>
            <X className="size-3.5" aria-hidden="true" />
            Decline
          </Button>
        </div>
      ) : null}

      {/* No `tool_calls` row exists for a permission-denied proposal
          (`toolCallId` stays null) -- nothing for Retry to re-run, and the
          caller's role isn't going to change by clicking it again, so the
          button is omitted rather than shown disabled or silently doing
          nothing. */}
      {isFailed && toolCall.toolCallId ? (
        <div>
          <Button size="sm" variant="secondary" onClick={onRetry} aria-label={`Retry: ${label}`}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Retry
          </Button>
        </div>
      ) : null}

      {toolCall.status === "rejected" ? <p className="text-meta text-fg-200">You declined this action.</p> : null}

      {toolCall.status === "succeeded" && toolCall.commitResult ? (
        <div className="flex items-center gap-2 text-meta text-emerald-fg">
          <Check className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{toolCall.commitResult.summary}</span>
          {toolCall.commitResult.href ? (
            <a href={toolCall.commitResult.href} className="text-blue-fg underline-offset-2 hover:underline">
              View
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <motion.div initial={enter} animate={settled} exit={enter} transition={base} data-tool-call-status={toolCall.status}>
      {isRunning ? <Shimmer>{body}</Shimmer> : body}
    </motion.div>
  );
}
