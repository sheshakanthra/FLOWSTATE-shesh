"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOpenState } from "@/lib/use-open-state";
import { base, instant, useReducedMotion } from "@/lib/motion";
import { Kbd } from "../kbd";
import { useRegisteredCommands } from "./registry";
import type { Command } from "./types";

export interface CommandPaletteProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Self-contained shell: manages its own open state (including the global
 * ⌘K/Ctrl+K listener) since there is no app shell yet to host that wiring.
 * Still accepts open/defaultOpen/onOpenChange so a later session can lift
 * control without touching this file.
 */
export function CommandPalette({ open, defaultOpen, onOpenChange }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useOpenState({ open, defaultOpen, onOpenChange });
  const commands = useRegisteredCommands();
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listboxId = React.useId();
  const reducedMotion = useReducedMotion();
  const transition = reducedMotion ? instant : base;

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen(!isOpen);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setIsOpen]);

  React.useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [isOpen]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (command) =>
        command.label.toLowerCase().includes(q) ||
        command.keywords?.some((keyword) => keyword.toLowerCase().includes(q)),
    );
  }, [commands, query]);

  const groups = React.useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const command of filtered) {
      const list = map.get(command.group) ?? [];
      list.push(command);
      map.set(command.group, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const activeCommand = filtered[activeIndex];

  function commit(command: Command) {
    command.onSelect();
    setIsOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      if (activeCommand) {
        event.preventDefault();
        commit(activeCommand);
      }
    }
  }

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <AnimatePresence>
        {isOpen ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-ink-000/70"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={transition}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content
              asChild
              forceMount
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                inputRef.current?.focus();
              }}
            >
              <motion.div
                className={cn(
                  "fixed top-[20%] left-1/2 z-50 w-full max-w-lg -translate-x-1/2",
                  "overflow-hidden rounded-xl border border-ink-500/60 bg-ink-300 text-fg-000",
                  "shadow-floating backdrop-blur-[var(--blur-floating)]",
                )}
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
                transition={transition}
              >
                <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
                <DialogPrimitive.Description className="sr-only">
                  Search and run commands
                </DialogPrimitive.Description>

                <div className="flex items-center gap-2 border-b border-ink-500/60 px-3">
                  <Search className="size-4 shrink-0 text-fg-200" aria-hidden="true" />
                  <input
                    ref={inputRef}
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-controls={listboxId}
                    aria-autocomplete="list"
                    aria-activedescendant={
                      activeCommand ? `${listboxId}-${activeCommand.id}` : undefined
                    }
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setActiveIndex(0);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a command..."
                    className="h-control-height w-full bg-transparent text-body text-fg-000 outline-none placeholder:text-fg-300"
                  />
                </div>

                {filtered.length === 0 ? (
                  // role="listbox" requires option/group children (ARIA in
                  // HTML) — an empty state has neither, so it's rendered as
                  // a status region sibling to the listbox rather than a
                  // roleless <li> inside it (which axe's aria-required-children
                  // and listitem rules both correctly reject). id stays on
                  // this element (not a <ul role="listbox">) so the input's
                  // aria-controls — a required combobox attribute — always
                  // resolves to something.
                  <p id={listboxId} role="status" className="px-3 py-6 text-center text-body text-fg-100">
                    {commands.length === 0
                      ? "No commands available yet."
                      : `No commands match "${query}"`}
                  </p>
                ) : (
                  <ul id={listboxId} role="listbox" className="max-h-80 overflow-auto p-1">
                    {groups.map(([group, items]) => (
                      <li key={group} role="presentation">
                        <div role="group" aria-label={group} className="px-2 py-1.5 text-meta text-fg-100">
                          {group}
                        </div>
                        <ul role="presentation">
                          {items.map((command) => {
                            const index = filtered.indexOf(command);
                            const Icon = command.icon;
                            return (
                              <li
                                key={command.id}
                                id={`${listboxId}-${command.id}`}
                                role="option"
                                aria-selected={index === activeIndex}
                                onMouseDown={(event) => event.preventDefault()}
                                onMouseEnter={() => setActiveIndex(index)}
                                onClick={() => commit(command)}
                                className={cn(
                                  "flex h-control-height cursor-default items-center gap-2 rounded-sm px-2 text-body select-none",
                                  "transition-instant transition-colors",
                                  index === activeIndex && "bg-ink-200",
                                )}
                              >
                                {Icon ? <Icon className="size-4 shrink-0 text-fg-200" /> : null}
                                <span className="flex-1">{command.label}</span>
                                {command.shortcut ? (
                                  <span className="flex gap-1">
                                    {command.shortcut.map((key) => (
                                      <Kbd key={key}>{key}</Kbd>
                                    ))}
                                  </span>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

export { registerCommands, useCommands, useRegisteredCommands } from "./registry";
export type { Command } from "./types";
