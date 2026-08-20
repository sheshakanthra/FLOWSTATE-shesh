"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { cn, focusRing } from "@/lib/utils";
import { loadPrompts, savePrompt, usePromptLibrary, type PromptRecord } from "./store";

export interface PromptLibraryMenuProps {
  workspaceSlug: string;
  draft: string;
  onDraftChange: (value: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

/**
 * Session spec item 8: `/` opens this, at the start of the composer's
 * draft -- typing anything after it filters the list, Enter or a click
 * inserts (replaces the draft with) that prompt's content, Escape clears
 * the draft (closing the menu as a side effect, nothing left to filter).
 *
 * Hand-built on the textarea's own `keydown`, capture phase, the same shape
 * B2's keyboard-connection-store used to preempt a bubble-phase handler
 * (here, the composer's own Enter-to-send) -- not Radix Popover, whose
 * trigger/anchor model assumes a dedicated element to open it, not "the
 * user typed a character into an existing textarea."
 */
export function PromptLibraryMenu({ workspaceSlug, draft, onDraftChange, textareaRef }: PromptLibraryMenuProps) {
  const { prompts, status } = usePromptLibrary();
  const open = draft.startsWith("/");
  const query = open ? draft.slice(1).trim().toLowerCase() : "";
  const filtered = React.useMemo(
    () =>
      open
        ? prompts.filter((prompt) => prompt.title.toLowerCase().includes(query) || prompt.content.toLowerCase().includes(query))
        : [],
    [open, prompts, query],
  );
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [saveOpen, setSaveOpen] = React.useState(false);
  const listboxId = React.useId();

  React.useEffect(() => {
    if (open) void loadPrompts(workspaceSlug);
  }, [open, workspaceSlug]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const select = React.useCallback(
    (prompt: PromptRecord) => {
      onDraftChange(prompt.content);
      textareaRef.current?.focus();
    },
    [onDraftChange, textareaRef],
  );

  React.useEffect(() => {
    const element = textareaRef.current;
    if (!element || !open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === "Enter") {
        const target = filtered[activeIndex];
        if (target) {
          event.preventDefault();
          event.stopPropagation();
          select(target);
        }
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onDraftChange("");
      }
    }

    element.addEventListener("keydown", handleKeyDown, true);
    return () => element.removeEventListener("keydown", handleKeyDown, true);
  }, [open, filtered, activeIndex, textareaRef, onDraftChange, select]);

  if (!open) return null;

  return (
    <>
      <div
        role="listbox"
        id={listboxId}
        aria-label="Saved prompts"
        className="absolute inset-x-0 bottom-full z-20 mb-1 max-h-56 overflow-y-auto rounded-md border border-ink-500/60 bg-ink-300 p-1 text-fg-000 shadow-floating"
      >
        {status === "loading" ? <p className="px-2 py-1.5 text-meta text-fg-200">Loading prompts…</p> : null}
        {status === "ready" && filtered.length === 0 ? (
          <p className="px-2 py-1.5 text-meta text-fg-200">{query ? `No saved prompts match "${query}".` : "No saved prompts yet."}</p>
        ) : null}
        {filtered.map((prompt, index) => (
          <button
            key={prompt.id}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => select(prompt)}
            className={cn(
              "flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-1.5 text-left",
              "transition-instant transition-colors",
              index === activeIndex ? "bg-ink-400" : "hover:bg-ink-400/60",
            )}
          >
            <span className="text-label font-medium text-fg-000">{prompt.title}</span>
            <span className="line-clamp-1 text-meta text-fg-200">{prompt.content}</span>
          </button>
        ))}
        <div className="mt-1 border-t border-ink-400 pt-1">
          <button
            type="button"
            onClick={() => setSaveOpen(true)}
            className={cn(
              "flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-left text-meta text-fg-100",
              "transition-instant transition-colors hover:bg-ink-400/60",
              focusRing,
            )}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Save a new prompt
          </button>
        </div>
      </div>

      <SavePromptDialog open={saveOpen} onOpenChange={setSaveOpen} workspaceSlug={workspaceSlug} />
    </>
  );
}

function SavePromptDialog({
  open,
  onOpenChange,
  workspaceSlug,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
}) {
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setContent("");
    }
  }, [open]);

  async function handleSave() {
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedTitle || !trimmedContent) return;
    setSaving(true);
    try {
      await savePrompt(workspaceSlug, trimmedTitle, trimmedContent);
      toast({ title: `Saved "${trimmedTitle}"` });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Couldn't save this prompt",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "danger",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save a prompt</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <FormField label="Title">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Weekly client recap" autoFocus />
          </FormField>
          <FormField label="Prompt">
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={4}
              placeholder="What should this prompt say?"
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} loading={saving} disabled={!title.trim() || !content.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
