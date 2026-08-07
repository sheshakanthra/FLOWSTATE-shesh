import {
  Bot,
  LayoutDashboard,
  LineChart,
  type LucideIcon,
  Settings,
  Workflow,
  Library,
} from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  segment: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "today", label: "Today", segment: "today", icon: LayoutDashboard },
  { id: "agents", label: "Agents", segment: "agents", icon: Bot },
  { id: "flows", label: "Flows", segment: "flows", icon: Workflow },
  { id: "knowledge", label: "Knowledge", segment: "knowledge", icon: Library },
  { id: "insights", label: "Insights", segment: "insights", icon: LineChart },
  { id: "settings", label: "Settings", segment: "settings", icon: Settings },
];

export function navHref(workspaceSlug: string, segment: string): string {
  return `/w/${workspaceSlug}/${segment}`;
}
