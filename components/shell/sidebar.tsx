"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NAV_ITEMS, navHref } from "./nav";
import { WorkspaceSwitcher, type WorkspaceSwitcherProps } from "./workspace-switcher";
import { UserMenu, type UserMenuProps } from "./user-menu";

export interface SidebarProps {
  workspaceSlug: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  workspaceSwitcher: WorkspaceSwitcherProps;
  userMenu: UserMenuProps;
}

export function Sidebar({
  workspaceSlug,
  collapsed,
  onToggleCollapse,
  workspaceSwitcher,
  userMenu,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-ink-400 bg-ink-050",
        "transition-[width] transition-base",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className={cn("flex h-control-height items-center border-b border-ink-400", collapsed ? "justify-center px-2" : "px-3")}>
        <WorkspaceSwitcher {...workspaceSwitcher} collapsed={collapsed} />
      </div>

      <nav aria-label="Primary" className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => {
          const href = navHref(workspaceSlug, item.segment);
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          const Icon = item.icon;
          const link = (
            <Link
              key={item.id}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex h-control-height items-center gap-2.5 rounded-md px-2.5 text-body text-fg-100",
                "transition-instant transition-colors hover:bg-ink-200 hover:text-fg-000",
                collapsed && "justify-center px-0",
                isActive && "bg-ink-200 text-fg-000",
                focusRing,
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {collapsed ? <span className="sr-only">{item.label}</span> : <span>{item.label}</span>}
            </Link>
          );

          if (!collapsed) return link;
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      <div className={cn("flex flex-col gap-1 border-t border-ink-400 p-2", collapsed && "items-center")}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "flex h-control-height items-center gap-2.5 rounded-md px-2.5 text-fg-100",
                "transition-instant transition-colors hover:bg-ink-200 hover:text-fg-000",
                collapsed ? "w-control-height justify-center px-0" : "w-full",
                focusRing,
              )}
            >
              {collapsed ? (
                <PanelLeft className="size-4 shrink-0" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="size-4 shrink-0" aria-hidden="true" />
              )}
              {!collapsed ? <span className="text-label">Collapse</span> : null}
            </button>
          </TooltipTrigger>
          {collapsed ? <TooltipContent side="right">Expand sidebar (⌘\)</TooltipContent> : null}
        </Tooltip>
        <UserMenu {...userMenu} collapsed={collapsed} />
      </div>
    </aside>
  );
}
