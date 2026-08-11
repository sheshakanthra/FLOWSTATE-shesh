"use client";

import * as React from "react";
import { z } from "zod";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { getModelLabel } from "@/lib/llm/models";
import type { ScopeVariable } from "../lib/scope";
import { PromptField } from "./variable-autocomplete";

export type FieldKind = "text" | "prompt" | "select" | "switch" | "slider" | "number";

/**
 * No config schema in this codebase carries field-level render hints (no
 * "widget: slider" metadata) -- registry.ts's NodeTypeDefinition is
 * data-only by design (see B2's decisions). So the mapping from a Zod shape
 * to a control is inferred structurally: enum -> Select, boolean -> Switch,
 * a number with both a min and max -> Slider (temperature has both; topK/
 * maxIterations/timeoutMinutes only have a floor, so they stay a plain
 * number Input), everything else string -> Input, except a field whose key
 * reads as prompt/expression-shaped -> a Textarea with variable
 * autocomplete, per the session spec's item 2.
 */
export function inferFieldKind(key: string, schema: z.ZodTypeAny): FieldKind {
  if (schema instanceof z.ZodEnum) return "select";
  if (schema instanceof z.ZodBoolean) return "switch";
  if (schema instanceof z.ZodNumber) {
    return schema.minValue !== null && schema.maxValue !== null ? "slider" : "number";
  }
  if (/prompt|expression/i.test(key)) return "prompt";
  return "text";
}

/** camelCase -> "Camel Case", for a field label when the schema has no
 *  human-readable label of its own. */
export function fieldLabel(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const MIXED_PLACEHOLDER = "Mixed values";

export interface SchemaFieldProps {
  fieldKey: string;
  schema: z.ZodTypeAny;
  /** `undefined` means "mixed" -- selected nodes disagree on this field's
   *  value (multi-select shared-property editing). */
  value: unknown;
  mixed: boolean;
  error?: string;
  onCommit: (value: unknown) => void;
  onBlur: () => void;
  scope: ScopeVariable[];
}

export function SchemaField({ fieldKey, schema, value, mixed, error, onCommit, onBlur, scope }: SchemaFieldProps) {
  const kind = inferFieldKind(fieldKey, schema);
  const label = fieldLabel(fieldKey);
  const id = `node-config-${fieldKey}`;

  if (kind === "select" && schema instanceof z.ZodEnum) {
    const options = schema.options as string[];
    // "model" is the one enum field with a real id-vs-display-label split
    // (lib/llm/models.ts's Groq model ids aren't meant to be read raw) --
    // every other enum in this codebase (triggerType, memory's scope, ...)
    // already uses its own values as the human-readable label, so this
    // stays a targeted special case rather than new schema-wide metadata.
    const optionLabel = fieldKey === "model" ? getModelLabel : (option: string) => option;
    return (
      <FormField label={label} error={error} htmlFor={id}>
        <Select value={mixed ? undefined : String(value)} onValueChange={(next) => onCommit(next)}>
          <SelectTrigger id={id} aria-invalid={error ? true : undefined}>
            <SelectValue placeholder={mixed ? MIXED_PLACEHOLDER : undefined}>
              {mixed ? undefined : optionLabel(String(value))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {optionLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
    );
  }

  if (kind === "switch") {
    return (
      <FormField label={label} error={error} htmlFor={id}>
        <Switch
          id={id}
          checked={mixed ? false : Boolean(value)}
          onCheckedChange={(checked) => onCommit(checked)}
        />
      </FormField>
    );
  }

  if (kind === "slider" && schema instanceof z.ZodNumber) {
    const min = schema.minValue ?? 0;
    const max = schema.maxValue ?? 100;
    const step = schema.isInt ? 1 : (max - min) / 100 || 0.01;
    const current = mixed || typeof value !== "number" ? min : value;
    return (
      <FormField label={mixed ? `${label} (${MIXED_PLACEHOLDER})` : `${label} — ${current}`} error={error} htmlFor={id}>
        <Slider
          id={id}
          label={label}
          min={min}
          max={max}
          step={step}
          value={[current]}
          onValueChange={([next]) => {
            if (next !== undefined) onCommit(next);
          }}
          onBlur={onBlur}
        />
      </FormField>
    );
  }

  if (kind === "number") {
    return (
      <FormField label={label} error={error} htmlFor={id}>
        <Input
          id={id}
          type="number"
          aria-invalid={error ? true : undefined}
          placeholder={mixed ? MIXED_PLACEHOLDER : undefined}
          value={mixed ? "" : typeof value === "number" ? value : ""}
          onChange={(event) => {
            const next = event.target.valueAsNumber;
            if (!Number.isNaN(next)) onCommit(next);
          }}
          onBlur={onBlur}
        />
      </FormField>
    );
  }

  if (kind === "prompt") {
    return (
      <PromptField
        id={id}
        label={label}
        error={error}
        mixed={mixed}
        value={mixed || typeof value !== "string" ? "" : value}
        scope={scope}
        onCommit={(next) => onCommit(next)}
        onBlur={onBlur}
      />
    );
  }

  return (
    <FormField label={label} error={error} htmlFor={id}>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        placeholder={mixed ? MIXED_PLACEHOLDER : undefined}
        value={mixed || typeof value !== "string" ? "" : value}
        onChange={(event) => onCommit(event.target.value)}
        onBlur={onBlur}
      />
    </FormField>
  );
}
