"use client";

import * as React from "react";
import type { PortType } from "./port-types";

/**
 * Ephemeral UI state for the keyboard connection path (gate item 6: Tab
 * between nodes, Enter to focus a node's ports, `c` to begin a connection,
 * arrows to choose a target, Enter to complete, Esc to cancel). Deliberately
 * its own tiny external store -- same `useSyncExternalStore` + module-level
 * state shape as the Toast queue and CommandPalette's registry -- rather than
 * a field on useGraphStore or useCanvasStore: it's interaction state with no
 * persistence value and a very different update frequency (keypress-driven,
 * not 60Hz viewport writes or graph mutations), and every Port component
 * subscribing to it would otherwise have no reason to touch either store.
 */
export interface PortCandidate {
  nodeId: string;
  portId: string;
}

export type KeyboardConnectionState =
  | { phase: "idle" }
  | { phase: "port-focus"; nodeId: string; side: "input" | "output"; portId: string }
  | {
      phase: "connecting";
      nodeId: string;
      portId: string;
      portType: PortType;
      candidates: PortCandidate[];
      activeIndex: number;
    };

const IDLE_STATE: KeyboardConnectionState = { phase: "idle" };

let state: KeyboardConnectionState = IDLE_STATE;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getKeyboardConnectionState(): KeyboardConnectionState {
  return state;
}

export function setKeyboardConnectionState(next: KeyboardConnectionState): void {
  state = next;
  emit();
}

export function resetKeyboardConnection(): void {
  setKeyboardConnectionState(IDLE_STATE);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY_STATE: KeyboardConnectionState = IDLE_STATE;
function getServerSnapshot(): KeyboardConnectionState {
  return EMPTY_STATE;
}

export function useKeyboardConnectionState(): KeyboardConnectionState {
  return React.useSyncExternalStore(subscribe, getKeyboardConnectionState, getServerSnapshot);
}
