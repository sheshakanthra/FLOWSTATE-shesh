import type { ComponentType } from "react";

export interface Command {
  id: string;
  label: string;
  group: string;
  onSelect: () => void;
  icon?: ComponentType<{ className?: string }>;
  keywords?: string[];
  shortcut?: string[];
}
