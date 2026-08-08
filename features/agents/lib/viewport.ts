/**
 * Pure helpers for the canvas's viewport interactions -- zoom bounds and
 * keyboard-shortcut detection. Kept dependency-free (no React, no
 * @xyflow/react) so they're trivially unit-testable and so `index.tsx`
 * doesn't hand-roll key-matching logic inline.
 */

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 2;

export const FIT_VIEW_PADDING = 0.2;

/**
 * Above this many nodes, React Flow's `onlyRenderVisibleElements` switches
 * on and off-viewport nodes unmount. Below it, everything stays mounted --
 * cheap enough at that scale, and keeps the minimap/selection math simple.
 */
export const VIRTUALIZATION_NODE_THRESHOLD = 100;

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

function hasModifier(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey;
}

/** ⌘= (and ⌘+, since Shift+= reports as "+" on US keyboard layouts). */
export function isZoomInShortcut(event: KeyboardEvent): boolean {
  return hasModifier(event) && (event.key === "=" || event.key === "+");
}

/** ⌘- */
export function isZoomOutShortcut(event: KeyboardEvent): boolean {
  return hasModifier(event) && event.key === "-";
}

/** ⌘0 -- fits to view, not a reset to 100% (that's the context menu's "Reset zoom"). */
export function isFitViewShortcut(event: KeyboardEvent): boolean {
  return hasModifier(event) && event.key === "0";
}

/** ⌘A -- select every node in the graph, matching DataTable's precedent for "select all". */
export function isSelectAllShortcut(event: KeyboardEvent): boolean {
  return hasModifier(event) && event.key.toLowerCase() === "a";
}

/** ⌘C -- copy the current node selection into the canvas's in-memory clipboard. */
export function isCopyShortcut(event: KeyboardEvent): boolean {
  return hasModifier(event) && event.key.toLowerCase() === "c";
}

/** ⌘V -- paste the in-memory clipboard, offset from the copied nodes' original position. */
export function isPasteShortcut(event: KeyboardEvent): boolean {
  return hasModifier(event) && event.key.toLowerCase() === "v";
}

/** ⌘D -- duplicate the current selection in place (offset, reselected), without touching the clipboard. */
export function isDuplicateShortcut(event: KeyboardEvent): boolean {
  return hasModifier(event) && event.key.toLowerCase() === "d";
}
