"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { focusRing } from "@/lib/utils";

export type SnoozePreset = "1h" | "tomorrow" | "next-week";

export const SNOOZE_PRESETS: { id: SnoozePreset; label: string }[] = [
  { id: "1h", label: "1 hour" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "next-week", label: "Next week" },
];

/** `tomorrow`/`next-week` land at 9am local time -- "snoozed until later
 *  today at 4:37pm" reads as an arbitrary instant; "tomorrow morning" and
 *  "next Monday-ish morning" read as real return points a person would
 *  actually plan around. `1h` is a literal, exact hour -- there's no
 *  "morning" framing that makes sense for a same-day snooze. */
export function getSnoozeUntil(preset: SnoozePreset, now: Date = new Date()): Date {
  if (preset === "1h") return new Date(now.getTime() + 60 * 60 * 1000);

  const daysAhead = preset === "tomorrow" ? 1 : 7;
  const target = new Date(now);
  target.setDate(target.getDate() + daysAhead);
  target.setHours(9, 0, 0, 0);
  return target;
}

export interface SnoozeMenuProps {
  onSnooze: (preset: SnoozePreset) => void;
  disabled?: boolean;
}

/** The pointer/menu half of gate item 4's snooze action -- offers the full
 *  three presets. The keyboard `s` shortcut (queue.tsx) applies "tomorrow"
 *  directly rather than opening this menu, since a single keystroke reads
 *  as "snooze, the usual amount," not "open a picker" -- see queue.tsx's
 *  own decision note. */
export function SnoozeMenu({ onSnooze, disabled }: SnoozeMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="secondary" disabled={disabled} className={focusRing}>
          <Clock className="size-3.5" aria-hidden="true" />
          Snooze
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {SNOOZE_PRESETS.map((preset) => (
          <DropdownMenuItem key={preset.id} onSelect={() => onSnooze(preset.id)}>
            {preset.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
