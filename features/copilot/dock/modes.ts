"use client";

import { Maximize2, PanelRight, Square, type LucideIcon } from "lucide-react";

export type DockMode = "docked" | "floating" | "fullscreen";

/** The width A6 reserved for this slot, kept as the default so the dock
 *  opens at exactly the size the shell was built around. */
export const DOCK_DEFAULT_WIDTH = 380;
export const DOCK_MIN_WIDTH = 320;
export const DOCK_MAX_WIDTH = 720;

export const DOCK_MODE_STORAGE_KEY = "kiln:copilot:mode";
/** `lib/use-resizable.ts` owns the width under its own `kiln:resizable:`
 *  prefix; this is the id it's keyed on. */
export const DOCK_RESIZE_ID = "copilot-dock";

export interface DockModeOption {
  id: DockMode;
  label: string;
  icon: LucideIcon;
}

export const DOCK_MODES: readonly DockModeOption[] = [
  { id: "docked", label: "Dock right", icon: PanelRight },
  { id: "floating", label: "Float", icon: Square },
  { id: "fullscreen", label: "Fullscreen", icon: Maximize2 },
];

function isDockMode(value: string | null): value is DockMode {
  return value === "docked" || value === "floating" || value === "fullscreen";
}

/**
 * Read once, from a mount effect — never during render. The dock is closed
 * on first paint, so resolving the persisted mode a tick late is invisible,
 * and reading storage during render would make the server and client
 * markup disagree.
 */
export function readStoredMode(): DockMode {
  if (typeof window === "undefined") return "docked";
  const stored = window.localStorage.getItem(DOCK_MODE_STORAGE_KEY);
  return isDockMode(stored) ? stored : "docked";
}

export function persistMode(mode: DockMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DOCK_MODE_STORAGE_KEY, mode);
}
