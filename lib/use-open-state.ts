"use client";

import * as React from "react";

export interface OpenStateProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Shared controlled/uncontrolled open-state hook for every overlay Root
 * wrapper in components/ui. Radix's own Root primitives resolve this
 * internally but don't expose the resolved boolean to sibling parts (e.g. a
 * Content that needs to gate its own AnimatePresence/forceMount rendering),
 * so each overlay Root re-derives it here and forwards it both back into the
 * underlying Radix Root (open/onOpenChange) and downward through a
 * file-local context for Content to read.
 *
 * Kept out of lib/utils.ts (a hook needs "use client", and lib/utils.ts is
 * imported by Server Components like components/ui/card.tsx for `cn` alone).
 */
export function useOpenState(props: OpenStateProps): [boolean, (open: boolean) => void] {
  const [uncontrolled, setUncontrolled] = React.useState(props.defaultOpen ?? false);
  const open = props.open ?? uncontrolled;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (props.open === undefined) setUncontrolled(next);
      props.onOpenChange?.(next);
    },
    [props.open, props.onOpenChange],
  );
  return [open, setOpen];
}
