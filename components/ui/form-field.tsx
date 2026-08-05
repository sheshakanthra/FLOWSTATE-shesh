"use client";

import * as React from "react";
import { Label } from "./label";
import { cn } from "@/lib/utils";

interface ControlProps {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-required"?: boolean;
}

export interface FormFieldProps {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactElement<ControlProps>;
}

/**
 * Label + control + description + error, with aria-describedby / aria-invalid
 * / id wired onto the control automatically — consumers never pass those by
 * hand. Pass a single control element (Input, Select, Combobox, ...); its
 * existing props (including an RHF `register()` ref) are preserved.
 */
export function FormField({
  label,
  description,
  error,
  required,
  htmlFor,
  className,
  children,
}: FormFieldProps) {
  const generatedId = React.useId();
  const controlId = htmlFor ?? children.props.id ?? generatedId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  const control = React.cloneElement(children, {
    id: controlId,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : children.props["aria-invalid"],
    "aria-required": required || undefined,
  });

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={controlId}>
        {label}
        {required ? (
          <span className="text-red-fg" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </Label>
      {control}
      {description ? (
        <p id={descriptionId} className="text-meta text-fg-100">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-meta text-red-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}
