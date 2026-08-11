"use client";

import * as React from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { SchemaField } from "../inspector/field-renderers";
import type { AnyNodeTypeDefinition } from "../nodes/registry";

export interface InputFormProps {
  triggerDefinition: AnyNodeTypeDefinition | undefined;
  disabled: boolean;
  onRun: (runInput: Record<string, unknown>) => void;
  onCancel: () => void;
  isRunning: boolean;
}

function getShape(definition: AnyNodeTypeDefinition | undefined): z.ZodRawShape {
  if (!definition) return {};
  const schema = definition.configSchema;
  return schema instanceof z.ZodObject ? (schema.shape as z.ZodRawShape) : {};
}

/**
 * Session spec item 4: "Input form derived from the trigger node's
 * schema." There's no separate "run payload" schema anywhere in this
 * codebase -- a trigger node's own Zod `configSchema` (`triggerType`,
 * `schedule`) is the only schema a trigger has, so this reuses it
 * literally, reusing the Inspector's own `SchemaField` renderer (B3) for
 * one-node, non-multi-select, non-undo-registered editing: `mixed` is
 * always `false` and `onBlur` is a no-op, since a run input form has no
 * per-field validation-on-blur or coalesced-undo concerns of its own.
 * Whatever the form resolves to becomes `ctx.runInput` for the whole run
 * (see the trigger node executor, which is the only executor that reads
 * it) -- available to every other node via `{{<trigger-label>.out}}`.
 */
export function InputForm({ triggerDefinition, disabled, onRun, onCancel, isRunning }: InputFormProps) {
  const shape = React.useMemo(() => getShape(triggerDefinition), [triggerDefinition]);
  const [values, setValues] = React.useState<Record<string, unknown>>(() => ({ ...triggerDefinition?.defaultConfig }));

  React.useEffect(() => {
    setValues({ ...triggerDefinition?.defaultConfig });
  }, [triggerDefinition]);

  if (!triggerDefinition) {
    return <p className="text-meta text-fg-200">Add a trigger node to the canvas to run this agent.</p>;
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onRun(values);
      }}
    >
      {Object.entries(shape).map(([key, fieldSchema]) => (
        <SchemaField
          key={key}
          fieldKey={key}
          schema={fieldSchema}
          value={values[key]}
          mixed={false}
          scope={[]}
          onCommit={(next) => setValues((current) => ({ ...current, [key]: next }))}
          onBlur={() => {}}
        />
      ))}
      {isRunning ? (
        <Button type="button" variant="danger" onClick={onCancel}>
          Cancel run
        </Button>
      ) : (
        <Button type="submit" variant="primary" disabled={disabled}>
          Run
        </Button>
      )}
    </form>
  );
}
