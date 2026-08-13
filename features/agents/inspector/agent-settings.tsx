"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { History } from "lucide-react";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { AgentDetailRecord } from "@/lib/repos/agents";
import { PublishDialog } from "../versions/publish-dialog";

export interface AgentSettingsProps {
  agent: Pick<AgentDetailRecord, "name" | "description" | "status">;
  workspaceSlug: string;
  agentId: string;
}

const STATUS_VARIANT: Record<AgentDetailRecord["status"], BadgeVariant> = {
  published: "emerald",
  draft: "blue",
  failing: "red",
  archived: "amber",
};

/**
 * What the Inspector shows when nothing on the canvas is selected (session
 * spec item 1) -- the agent's own name/description rather than a blank
 * panel. Edits save on blur, through the same PATCH route the graph
 * autosave uses, but deliberately outside that route's debounce/undo/
 * FiringBar machinery: the spec's undo-integration list (item 6) names only
 * graph operations (add/delete/move/connect/disconnect/edit property/
 * paste), not agent metadata, so this stays a plain optimistic save rather
 * than pulling agent-settings edits into the graph's coalesced-undo system.
 */
export function AgentSettings({ agent, workspaceSlug, agentId }: AgentSettingsProps) {
  const router = useRouter();
  const [name, setName] = React.useState(agent.name);
  const [description, setDescription] = React.useState(agent.description ?? "");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setName(agent.name);
    setDescription(agent.description ?? "");
  }, [agent.name, agent.description]);

  async function save(patch: { name?: string; description?: string }) {
    setSaving(true);
    try {
      await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug, ...patch }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-meta font-medium text-fg-200 uppercase tracking-wide">Agent settings</h3>
          <Badge variant={STATUS_VARIANT[agent.status]}>{agent.status}</Badge>
        </div>
        <p className="text-body text-fg-100">No node selected — select a node on the canvas to edit its properties.</p>
      </section>

      <section className="flex items-center gap-2">
        <PublishDialog
          agentId={agentId}
          workspaceSlug={workspaceSlug}
          isFirstPublish={agent.status === "draft"}
          onPublished={() => router.refresh()}
        />
        <Link
          href={`/w/${workspaceSlug}/agents/${agentId}/versions`}
          className="flex items-center gap-1.5 text-meta text-fg-100 hover:text-fg-000 hover:underline"
        >
          <History className="size-3.5" aria-hidden="true" />
          Version history
        </Link>
      </section>

      <section className="flex flex-col gap-3">
        <FormField label="Name" htmlFor="agent-name">
          <Input
            id="agent-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => {
              if (name.trim().length > 0 && name !== agent.name) void save({ name });
            }}
          />
        </FormField>
        <FormField label="Description" htmlFor="agent-description">
          <Textarea
            id="agent-description"
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() => {
              if (description !== (agent.description ?? "")) void save({ description });
            }}
          />
        </FormField>
        {saving ? <p className="text-meta text-fg-200">Saving…</p> : null}
      </section>
    </div>
  );
}
