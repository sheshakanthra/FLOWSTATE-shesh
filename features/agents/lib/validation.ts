import { getNodeType } from "../nodes/registry";
import { findCycle } from "./cycle-detect";
import { arePortTypesCompatible, describeIncompatibility, type PortType } from "./port-types";

export interface ConnectionCandidate {
  source: string | null;
  sourceHandle?: string | null;
  target: string | null;
  targetHandle?: string | null;
}

export interface ValidationNode {
  id: string;
  type?: string;
  data: { label: string };
}

export interface ValidationEdge {
  source: string;
  target: string;
}

export type ConnectionValidation = { valid: true } | { valid: false; reason: string };

/** Looks up a port's declared type via the node's registered type -- the
 *  same lookup both `isValidConnection` (drag) and the keyboard connection
 *  path use to know what's compatible before a drop is ever attempted. */
export function resolvePortType(
  nodes: readonly ValidationNode[],
  nodeId: string | null | undefined,
  portId: string | null | undefined,
  direction: "input" | "output",
): PortType | null {
  if (!nodeId || !portId) return null;
  const node = nodes.find((candidate) => candidate.id === nodeId);
  if (!node?.type) return null;
  const definition = getNodeType(node.type);
  if (!definition) return null;
  const ports = direction === "input" ? definition.inputs : definition.outputs;
  return ports.find((port) => port.id === portId)?.type ?? null;
}

/**
 * The one place both the mouse-drag path (`isValidConnection`/`onConnect`)
 * and the keyboard connection path validate a candidate edge: port type
 * compatibility, then cycle detection. Cycle checking needs the full edge
 * list (a graph-global property, unlike per-port type compatibility), so
 * it's deliberately not part of the cheap per-hover `isValidConnection` gate
 * -- see canvas/index.tsx's decision to gate types during drag but reject
 * cycles with a named-cycle toast on drop instead.
 */
export function validateConnection(
  connection: ConnectionCandidate,
  nodes: readonly ValidationNode[],
  edges: readonly ValidationEdge[],
): ConnectionValidation {
  const { source, sourceHandle, target, targetHandle } = connection;
  if (!source || !target || !sourceHandle || !targetHandle) {
    return { valid: false, reason: "Connect a specific output port to a specific input port." };
  }
  if (source === target) {
    return { valid: false, reason: "A node can't connect to itself." };
  }

  const sourceType = resolvePortType(nodes, source, sourceHandle, "output");
  const targetType = resolvePortType(nodes, target, targetHandle, "input");
  if (!sourceType || !targetType) {
    return { valid: false, reason: "Unknown port." };
  }
  if (!arePortTypesCompatible(sourceType, targetType)) {
    return { valid: false, reason: describeIncompatibility(sourceType, targetType) };
  }

  const nodeLabels = new Map(nodes.map((node) => [node.id, node.data.label]));
  const cycle = findCycle(edges, { source, target }, nodeLabels);
  if (cycle) {
    return { valid: false, reason: `This would create a cycle: ${cycle.join(" → ")}.` };
  }

  return { valid: true };
}

/** Type-compatibility only, no cycle check -- cheap enough to call on every
 *  hovered handle during a drag (`<ReactFlow isValidConnection>`). */
export function isTypeCompatibleConnection(
  connection: ConnectionCandidate,
  nodes: readonly ValidationNode[],
): boolean {
  const sourceType = resolvePortType(nodes, connection.source, connection.sourceHandle, "output");
  const targetType = resolvePortType(nodes, connection.target, connection.targetHandle, "input");
  if (!sourceType || !targetType) return false;
  if (connection.source === connection.target) return false;
  return arePortTypesCompatible(sourceType, targetType);
}
