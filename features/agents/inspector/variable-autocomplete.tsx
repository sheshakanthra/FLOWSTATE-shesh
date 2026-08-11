"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, focusRing } from "@/lib/utils";
import type { ScopeVariable } from "../lib/scope";
import { MIXED_PLACEHOLDER } from "./field-renderers";

export interface PromptFieldProps {
  id: string;
  label: string;
  value: string;
  mixed: boolean;
  error?: string;
  scope: ScopeVariable[];
  onCommit: (value: string) => void;
  onBlur: () => void;
}

/** Matches an unfinished `{{token` immediately before the cursor -- an
 *  already-closed `{{token}}` (or plain text with no trigger) doesn't
 *  match, so the popover only opens while actively typing a variable. */
const TRIGGER_PATTERN = /\{\{([a-zA-Z0-9_.]*)$/;

/**
 * A Textarea that opens a listbox of in-scope upstream variables the moment
 * the user types `{{`, filters it as they keep typing, and inserts the
 * selected token as `{{token}}` on Enter/click -- session spec item 3. The
 * offered list is exactly `scope` (features/agents/lib/scope.ts's upstream
 * walk for the node this field belongs to), never a flat list of every
 * variable in the graph.
 */
export function PromptField({ id, label, value, mixed, error, scope, onCommit, onBlur }: PromptFieldProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [triggerStart, setTriggerStart] = React.useState<number | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);

  const filtered = React.useMemo(
    () => (query ? scope.filter((variable) => variable.token.toLowerCase().includes(query.toLowerCase())) : scope),
    [scope, query],
  );

  function detectTrigger(text: string, cursor: number) {
    const match = TRIGGER_PATTERN.exec(text.slice(0, cursor));
    if (!match) {
      setOpen(false);
      return;
    }
    const partial = match[1] ?? "";
    setOpen(true);
    setQuery(partial);
    setTriggerStart(cursor - partial.length - 2);
    setActiveIndex(0);
  }

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = event.target.value;
    onCommit(next);
    detectTrigger(next, event.target.selectionStart ?? next.length);
  }

  function insertToken(token: string) {
    if (triggerStart === null) return;
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const next = `${value.slice(0, triggerStart)}{{${token}}}${value.slice(cursor)}`;
    onCommit(next);
    setOpen(false);
    const caretPos = triggerStart + token.length + 4;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(caretPos, caretPos);
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!open || filtered.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" || event.key === "Tab") {
      const target = filtered[activeIndex];
      if (target) {
        event.preventDefault();
        insertToken(target.token);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const listboxId = `${id}-variable-listbox`;
  const activeOptionId = filtered[activeIndex] ? `${id}-variable-option-${filtered[activeIndex].token}` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="relative flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        ref={textareaRef}
        id={id}
        rows={4}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        placeholder={mixed ? MIXED_PLACEHOLDER : "Type {{ to insert a variable from an upstream node…"}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          setOpen(false);
          onBlur();
        }}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-meta text-red-fg">
          {error}
        </p>
      ) : null}
      {open && filtered.length > 0 ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Variables in scope"
          className={cn(
            "absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border border-ink-500/60 bg-ink-300 p-1 text-fg-000 shadow-floating backdrop-blur-[var(--blur-floating)]",
          )}
        >
          {filtered.map((variable, index) => (
            <div
              key={variable.token}
              id={`${id}-variable-option-${variable.token}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => {
                event.preventDefault();
                insertToken(variable.token);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-body",
                "transition-instant transition-colors",
                index === activeIndex && "bg-ink-200",
                focusRing,
              )}
            >
              <span className="truncate font-medium">{variable.token}</span>
              <span className="shrink-0 text-meta text-fg-200">{variable.nodeLabel}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
