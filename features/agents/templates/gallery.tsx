"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getNodeType } from "../nodes/registry";
import { TEMPLATES } from "./definitions";

/** A tiny row of the template's own node-type icons, in graph order --
 *  the "preview thumbnail" the spec asks for. A rendered screenshot of the
 *  real canvas would need a whole headless-render pipeline this session
 *  doesn't own; this is honest (it's built from the template's real node
 *  types, not a stock image) and communicates the same thing a thumbnail
 *  would at a glance: what kind of graph this is. */
function TemplatePreview({ templateId, nodeTypes }: { templateId: string; nodeTypes: string[] }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-ink-400 bg-ink-050 p-3" aria-hidden="true">
      {nodeTypes.map((typeId, index) => {
        const definition = getNodeType(typeId);
        const Icon = definition?.icon;
        return (
          <React.Fragment key={`${templateId}-preview-${index}`}>
            {index > 0 ? <div className="h-px w-3 shrink-0 bg-ink-400" /> : null}
            <div className="flex size-7 shrink-0 items-center justify-center rounded-sm border border-ink-400 bg-ink-100 text-fg-200">
              {Icon ? <Icon className="size-3.5" /> : null}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export interface TemplateGalleryProps {
  workspaceSlug: string;
}

/**
 * Session spec item 6: starting a new agent offers these 6 real templates.
 * Selecting one POSTs to `/api/agents` (source: "template"), which
 * instantiates fresh node/edge ids server-side and creates a real draft
 * agent, then this navigates straight to that agent's builder -- the same
 * "created, now go edit it" flow a blank canvas used to be, just no longer
 * starting from nothing.
 */
export function TemplateGallery({ workspaceSlug }: TemplateGalleryProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [creatingId, setCreatingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSelect(templateId: string) {
    setCreatingId(templateId);
    setError(null);
    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "template", workspaceSlug, templateId }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Couldn't create this agent. Try again.");
        return;
      }
      const data = (await response.json()) as { agent: { id: string } };
      setOpen(false);
      router.push(`/w/${workspaceSlug}/agents/${data.agent.id}/build`);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setCreatingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary">
          <Plus className="size-4" aria-hidden="true" />
          New agent
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Start from a template</DialogTitle>
        </DialogHeader>

        {error ? <p className="mb-3 text-meta text-red-fg">{error}</p> : null}

        <div className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2">
          {TEMPLATES.map((template) => (
            <Card key={template.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-title-sm">{template.name}</CardTitle>
                <CardDescription>{template.description}</CardDescription>
              </CardHeader>
              <CardBody className="flex-1">
                <TemplatePreview templateId={template.id} nodeTypes={template.nodes.map((node) => node.type)} />
              </CardBody>
              <CardFooter className="justify-between">
                <span className="text-meta text-fg-200">
                  {template.nodes.length} node{template.nodes.length === 1 ? "" : "s"}
                </span>
                <Button
                  size="sm"
                  onClick={() => handleSelect(template.id)}
                  loading={creatingId === template.id}
                  disabled={creatingId !== null}
                  aria-label={`Use the ${template.name} template`}
                >
                  Use this template
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
