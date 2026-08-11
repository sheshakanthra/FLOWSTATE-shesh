"use client";

import * as React from "react";
import { z } from "zod";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useGraphStore, type CanvasNode } from "../store/graph-store";
import type { AnyNodeTypeDefinition } from "../nodes/registry";
import { resolveUpstreamScope } from "../lib/scope";
import { commitCoalescedEdit } from "../lib/graph-undo";
import { SchemaField, fieldLabel, MIXED_PLACEHOLDER } from "./field-renderers";

export interface SchemaFormProps {
  /** Every selected node, all sharing `definition`'s type -- one entry for
   *  a single selection, several for a same-type multi-select (gate item 7). */
  nodes: CanvasNode[];
  definition: AnyNodeTypeDefinition;
}

function getShape(definition: AnyNodeTypeDefinition): z.ZodRawShape {
  const schema = definition.configSchema;
  return schema instanceof z.ZodObject ? (schema.shape as z.ZodRawShape) : {};
}

/** `undefined` return means every selected node agrees on this field's
 *  current value; otherwise the field renders as "mixed." */
function sharedValue(nodes: CanvasNode[], key: string): { value: unknown; mixed: boolean } {
  const first = nodes[0]?.data.config[key];
  const mixed = nodes.some((node) => node.data.config[key] !== first);
  return { value: mixed ? undefined : first, mixed };
}

export function SchemaForm({ nodes, definition }: SchemaFormProps) {
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const shape = React.useMemo(() => getShape(definition), [definition]);
  const nodeIds = React.useMemo(() => nodes.map((node) => node.id), [nodes]);

  // Variable autocomplete scope is resolved against the first selected
  // node's upstream graph -- for a same-type multi-select the fields being
  // edited are shared, but "upstream of this specific node" is inherently
  // per-node, and picking one consistent node to source suggestions from
  // beats either merging unrelated graphs' variables or disabling
  // autocomplete outright during multi-edit.
  const scope = React.useMemo(() => {
    const first = nodes[0];
    if (!first) return [];
    const graph = useGraphStore.getState();
    return resolveUpstreamScope(first.id, graph.nodes, graph.edges);
  }, [nodes]);

  const commitField = React.useCallback(
    (key: string, newValue: unknown) => {
      const before = nodes.map((node) => ({ nodeId: node.id, key, value: node.data.config[key] }));
      const after = nodeIds.map((id) => ({ nodeId: id, key, value: newValue }));
      commitCoalescedEdit({
        key: `${nodeIds.join(",")}:${key}`,
        label: nodes.length > 1 ? `Edited ${fieldLabel(key)} on ${nodes.length} nodes` : `Edited ${fieldLabel(key)}`,
        before,
        after,
        apply: (entries) => useGraphStore.getState().setNodeConfigValues(entries as typeof before),
      });
    },
    [nodes, nodeIds],
  );

  const validateField = React.useCallback(
    (key: string) => {
      const fieldSchema = shape[key];
      if (!fieldSchema) return;
      const latestNodes = useGraphStore.getState().nodes;
      for (const id of nodeIds) {
        const node = latestNodes.find((candidate) => candidate.id === id);
        const result = fieldSchema.safeParse(node?.data.config[key]);
        if (!result.success) {
          setFieldErrors((current) => ({ ...current, [key]: result.error.issues[0]?.message ?? "Invalid value." }));
          return;
        }
      }
      setFieldErrors((current) => {
        if (!(key in current)) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
    },
    [shape, nodeIds],
  );

  const first = nodes[0];
  if (!first) return null;

  const singleLabel = nodes.length === 1 ? first.data.label : undefined;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3" aria-labelledby="inspector-section-identity">
        <h3 id="inspector-section-identity" className="text-meta font-medium text-fg-200 uppercase tracking-wide">
          Identity
        </h3>
        <FormField label="Name" htmlFor="node-label">
          <Input
            id="node-label"
            disabled={nodes.length > 1}
            placeholder={nodes.length > 1 ? MIXED_PLACEHOLDER : undefined}
            value={singleLabel ?? ""}
            onChange={(event) => {
              if (nodes.length !== 1) return;
              commitCoalescedEdit({
                key: `${first.id}:label`,
                label: "Renamed node",
                before: first.data.label,
                after: event.target.value,
                apply: (value) => useGraphStore.getState().setNodeLabel(first.id, value as string),
              });
            }}
          />
        </FormField>
        <FormField label="Type" htmlFor="node-type">
          <Input id="node-type" value={definition.label} disabled readOnly />
        </FormField>
      </section>

      {Object.keys(shape).length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="inspector-section-configuration">
          <h3 id="inspector-section-configuration" className="text-meta font-medium text-fg-200 uppercase tracking-wide">
            Configuration
          </h3>
          {Object.entries(shape).map(([key, fieldSchema]) => {
            const { value, mixed } = sharedValue(nodes, key);
            return (
              <SchemaField
                key={key}
                fieldKey={key}
                schema={fieldSchema}
                value={value}
                mixed={mixed}
                error={fieldErrors[key]}
                scope={scope}
                onCommit={(next) => commitField(key, next)}
                onBlur={() => validateField(key)}
              />
            );
          })}
        </section>
      ) : null}

      {nodes.length === 1 ? (
        <section className="flex flex-col gap-3" aria-labelledby="inspector-section-advanced">
          <h3 id="inspector-section-advanced" className="text-meta font-medium text-fg-200 uppercase tracking-wide">
            Advanced
          </h3>
          <FormField label="Disabled" description="Skip this node when the agent runs." htmlFor="node-disabled">
            <Switch
              id="node-disabled"
              checked={first.data.disabled === true}
              onCheckedChange={() => useGraphStore.getState().toggleNodeDisabled(first.id)}
            />
          </FormField>
        </section>
      ) : null}
    </div>
  );
}
