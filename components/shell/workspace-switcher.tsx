"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Pencil } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useCommands } from "@/components/ui/command-palette";
import { PermissionGate } from "@/lib/auth/permission-gate";
import type { WorkspaceSummary } from "@/lib/repos/workspaces";

export interface WorkspaceSwitcherProps {
  current: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
  collapsed?: boolean;
}

export function WorkspaceSwitcher({ current, workspaces, collapsed = false }: WorkspaceSwitcherProps) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [name, setName] = React.useState(current.name);
  const [saving, setSaving] = React.useState(false);

  const others = React.useMemo(
    () => workspaces.filter((workspace) => workspace.id !== current.id),
    [workspaces, current.id],
  );

  useCommands(
    "workspace-switcher",
    others.map((workspace) => ({
      id: `switch-workspace-${workspace.id}`,
      label: `Switch to ${workspace.name}`,
      group: "Switch workspace",
      icon: Building2,
      onSelect: () => router.push(`/w/${workspace.slug}/today`),
    })),
  );

  async function handleRename(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const response = await fetch(`/api/w/${current.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      toast({ title: "Couldn't rename workspace", description: body?.error, variant: "danger" });
      return;
    }
    toast({ title: "Workspace renamed", variant: "success" });
    setRenameOpen(false);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left",
              "transition-instant transition-colors hover:bg-ink-200",
              collapsed && "flex-none justify-center px-0",
              focusRing,
            )}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-ink-300 text-meta font-medium text-fg-100">
              {current.name.slice(0, 1).toUpperCase()}
            </span>
            {!collapsed ? (
              <>
                <span className="min-w-0 flex-1 truncate text-label font-medium text-fg-000">
                  {current.name}
                </span>
                <ChevronsUpDown className="size-3.5 shrink-0 text-fg-200" aria-hidden="true" />
              </>
            ) : null}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          <DropdownMenuItem disabled className="justify-between text-fg-000">
            {current.name}
            <Check className="size-4 text-blue-fg" aria-hidden="true" />
          </DropdownMenuItem>
          {others.map((workspace) => (
            <DropdownMenuItem key={workspace.id} onSelect={() => router.push(`/w/${workspace.slug}/today`)}>
              {workspace.name}
            </DropdownMenuItem>
          ))}
          <PermissionGate requires="owner">
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                setName(current.name);
                setRenameOpen(true);
              }}
            >
              <Pencil className="size-4 text-fg-200" aria-hidden="true" />
              Rename workspace
            </DropdownMenuItem>
          </PermissionGate>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename workspace</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename}>
            <FormField label="Workspace name">
              <Input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setRenameOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
