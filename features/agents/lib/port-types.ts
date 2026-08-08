/**
 * The whole port type system: five types, one compatibility rule. Deliberately
 * small -- see the session spec's note. A node whose port doesn't cleanly fit
 * one of these should use `any` and validate specifics in its own config
 * schema instead of growing this list.
 */
export type PortType = "text" | "json" | "document" | "signal" | "any";

export const PORT_TYPES: readonly PortType[] = ["text", "json", "document", "signal", "any"];

export interface PortDef {
  id: string;
  label: string;
  type: PortType;
}

/** `any` accepts everything, and everything accepts `any`; otherwise the two
 *  sides must match exactly. */
export function arePortTypesCompatible(source: PortType, target: PortType): boolean {
  if (source === "any" || target === "any") return true;
  return source === target;
}

/** Human-readable reason a connection attempt is blocked -- shown on hover
 *  before the drop is attempted (drag) and inline during the keyboard
 *  connection path. */
export function describeIncompatibility(source: PortType, target: PortType): string {
  return `A ${source} output can't connect to a ${target} input.`;
}
