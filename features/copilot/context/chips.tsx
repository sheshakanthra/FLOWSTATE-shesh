"use client";

import { Plus } from "lucide-react";
import { Tag } from "@/components/ui/tag";
import { cn, focusRing } from "@/lib/utils";
import { excludeField, restoreField, useCopilotSnapshot } from "./provider";

/**
 * Spec item 3: the composer shows what the copilot currently sees, as
 * removable chips. Dropping one excludes that field from the envelope
 * (gate item 5).
 *
 * Dropped chips stay on screen as muted "add back" buttons rather than
 * disappearing. The spec's requirement is that context be "visible and
 * editable, never hidden" — a chip that vanishes on removal satisfies
 * editable but quietly fails visible: the user is then looking at a
 * composer that no longer mentions the agent they're on, with nothing to
 * say whether that's because the copilot doesn't know or because they told
 * it to forget.
 */
export function ContextChips() {
  const { chips, restorable } = useCopilotSnapshot();

  if (chips.length === 0 && restorable.length === 0) {
    return (
      <p className="px-1 text-meta text-fg-200">
        No context on this screen yet — open an agent or select some runs.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Copilot context" role="group">
      {chips.map((chip) => (
        <Tag key={chip.field} onRemove={() => excludeField(chip.field)} removeLabel={`Remove ${chip.label} from context`}>
          {chip.label}
        </Tag>
      ))}
      {restorable.map((chip) => (
        <button
          key={chip.field}
          type="button"
          onClick={() => restoreField(chip.field)}
          aria-label={`Add ${chip.label} back to context`}
          className={cn(
            "inline-flex items-center gap-1 rounded-sm border border-dashed border-ink-400 py-0.5 pr-2 pl-1.5",
            "text-label text-fg-200 transition-instant transition-colors",
            "hover:border-ink-500 hover:text-fg-100",
            focusRing,
          )}
        >
          <Plus className="size-3" aria-hidden="true" />
          {chip.label}
        </button>
      ))}
    </div>
  );
}
