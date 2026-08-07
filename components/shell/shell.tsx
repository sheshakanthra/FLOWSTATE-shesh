"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PanelLeft, PanelLeftClose, Keyboard, MessageSquare } from "lucide-react";
import { Sidebar } from "./sidebar";
import { CopilotDock } from "./copilot-dock";
import { ShortcutOverlay } from "./shortcut-overlay";
import { NAV_ITEMS, navHref } from "./nav";
import type { WorkspaceSummary } from "@/lib/repos/workspaces";
import { FiringBar } from "@/components/firing-bar";
import { CommandPalette, useCommands } from "@/components/ui/command-palette";
import { Toaster } from "@/components/ui/toast";
import { useGlobalShortcuts } from "@/lib/shortcuts/registry";

const SIDEBAR_STORAGE_KEY = "kiln:sidebar:collapsed";

export interface ShellProps {
  currentWorkspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
  user: { name: string; email: string };
  children: React.ReactNode;
}

export function Shell({ currentWorkspace, workspaces, user, children }: ShellProps) {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [copilotOpen, setCopilotOpen] = React.useState(false);
  const [overlayOpen, setOverlayOpen] = React.useState(false);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) setSidebarCollapsed(stored === "1");
  }, []);

  const toggleSidebar = React.useCallback(() => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const toggleCopilot = React.useCallback(() => setCopilotOpen((open) => !open), []);
  const showOverlay = React.useCallback(() => setOverlayOpen(true), []);
  const navigateToday = React.useCallback(
    () => router.push(navHref(currentWorkspace.slug, "today")),
    [router, currentWorkspace.slug],
  );
  const navigateAgents = React.useCallback(
    () => router.push(navHref(currentWorkspace.slug, "agents")),
    [router, currentWorkspace.slug],
  );

  useGlobalShortcuts({
    onToggleSidebar: toggleSidebar,
    onToggleCopilot: toggleCopilot,
    onShowOverlay: showOverlay,
    onNavigateToday: navigateToday,
    onNavigateAgents: navigateAgents,
  });

  useCommands(
    "shell-nav",
    React.useMemo(
      () => [
        ...NAV_ITEMS.map((item) => ({
          id: `nav-${item.id}`,
          label: `Go to ${item.label}`,
          group: "Navigate",
          icon: item.icon,
          shortcut: item.id === "today" ? ["g", "t"] : item.id === "agents" ? ["g", "a"] : undefined,
          onSelect: () => router.push(navHref(currentWorkspace.slug, item.segment)),
        })),
        {
          id: "toggle-sidebar",
          label: sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar",
          group: "View",
          icon: sidebarCollapsed ? PanelLeft : PanelLeftClose,
          shortcut: ["⌘", "\\"],
          onSelect: toggleSidebar,
        },
        {
          id: "toggle-copilot",
          label: copilotOpen ? "Close copilot" : "Open copilot",
          group: "View",
          icon: MessageSquare,
          shortcut: ["⌘", "J"],
          onSelect: toggleCopilot,
        },
        {
          id: "show-shortcuts",
          label: "Show keyboard shortcuts",
          group: "Help",
          icon: Keyboard,
          shortcut: ["?"],
          onSelect: showOverlay,
        },
      ],
      [router, currentWorkspace.slug, sidebarCollapsed, copilotOpen, toggleSidebar, toggleCopilot, showOverlay],
    ),
  );

  return (
    <div className="flex h-screen overflow-hidden bg-ink-000">
      <Sidebar
        workspaceSlug={currentWorkspace.slug}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        workspaceSwitcher={{ current: currentWorkspace, workspaces }}
        userMenu={user}
      />
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      <CopilotDock open={copilotOpen} onClose={() => setCopilotOpen(false)} />
      <FiringBar />
      <CommandPalette />
      <ShortcutOverlay open={overlayOpen} onOpenChange={setOverlayOpen} />
      <Toaster />
    </div>
  );
}
