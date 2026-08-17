"use client";

import Link from "next/link";
import { Bot, PlayCircle } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";
import type { StreamCitation } from "../stream/client";

const TYPE_ICON = {
  agent: Bot,
  run: PlayCircle,
} as const;

export interface CitationPillProps {
  citation: StreamCitation;
}

/**
 * Session spec item 4: "renders a CitationPill that navigates to the source
 * record." Styled with `blue`, the one semantic hue CLAUDE.md assigns to
 * "informational/selected/focus" -- a citation pointing at a real,
 * server-verified record is exactly that, not a decorative reuse of the
 * color (rule 4).
 */
export function CitationPill({ citation }: CitationPillProps) {
  const Icon = TYPE_ICON[citation.type];
  return (
    <Link
      href={citation.href}
      className={cn(
        "mx-0.5 inline-flex items-center gap-1 rounded-full border border-blue-line bg-blue-bg px-1.5 py-0.5 align-middle",
        "text-meta font-medium text-blue-fg no-underline",
        "transition-instant transition-colors hover:border-blue-fg",
        focusRing,
      )}
      title={citation.label}
    >
      <Icon className="size-3" aria-hidden="true" />
      <span className="max-w-40 truncate">{citation.label}</span>
    </Link>
  );
}
