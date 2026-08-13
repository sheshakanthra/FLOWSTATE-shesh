"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

export interface ImportAgentButtonProps {
  workspaceSlug: string;
}

/** The other half of session spec item 7 ("export/import an agent as
 *  JSON") -- a plain hidden `<input type="file">` triggered by a visible
 *  button (the standard accessible pattern for a styled file picker: the
 *  native input stays keyboard/AT-operable, just visually hidden rather
 *  than `display:none`, which some screen readers skip entirely). Reads
 *  the file's raw text and posts it to `/api/agents` untouched --
 *  `parseAgentImport` runs there (and only there) as the authoritative
 *  check, so this component has no validation logic of its own to drift
 *  out of sync with it. */
export function ImportAgentButton({ workspaceSlug }: ImportAgentButtonProps) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [importing, setImporting] = React.useState(false);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    try {
      const raw = await file.text();
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "import", workspaceSlug, raw }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        toast({ title: "Couldn't import", description: data?.error ?? "Try a different file.", variant: "danger" });
        return;
      }
      const data = (await response.json()) as { agent: { id: string; name: string } };
      toast({ title: "Imported", description: `Created "${data.agent.name}".` });
      router.push(`/w/${workspaceSlug}/agents/${data.agent.id}/build`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Import agent JSON file"
      />
      <Button variant="secondary" onClick={() => inputRef.current?.click()} loading={importing}>
        <Upload className="size-4" aria-hidden="true" />
        Import
      </Button>
    </>
  );
}
