"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { useRegisteredCommands } from "@/components/ui/command-palette";

export interface ShortcutOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Lists every shortcut registered as a Command with a `shortcut` chip (see
 * components/shell/shell.tsx) — reads the same A3 command-palette registry
 * ⌘K searches, rather than keeping a second, separately-maintained list.
 */
export function ShortcutOverlay({ open, onOpenChange }: ShortcutOverlayProps) {
  const commands = useRegisteredCommands();
  const withShortcuts = React.useMemo(
    () => commands.filter((command) => command.shortcut && command.shortcut.length > 0),
    [commands],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <ul className="flex flex-col gap-1">
          {withShortcuts.map((command) => (
            <li key={command.id} className="flex items-center justify-between gap-4 py-1.5">
              <span className="text-body text-fg-000">{command.label}</span>
              <span className="flex gap-1">
                {command.shortcut?.map((key) => <Kbd key={key}>{key}</Kbd>)}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
