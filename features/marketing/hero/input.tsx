"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface HeroInputProps {
  disabled: boolean;
  submitting: boolean;
  onSubmit: (description: string) => void;
}

const PLACEHOLDER = "e.g. Follow up with every lead who hasn't replied in 3 days";

/** E1 spec item 1: "the input self-focuses on load." A plain, uncontrolled
 *  autofocus effect -- the entrance sequence in index.tsx fades this whole
 *  block in, but the DOM focus itself doesn't wait on that animation, so
 *  keyboard users typing immediately on page load land in the field rather
 *  than needing to wait out a transition first. */
export function HeroInput({ disabled, submitting, onSubmit }: HeroInputProps) {
  const [value, setValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <form
      className="flex w-full max-w-xl flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = value.trim();
        if (!trimmed || disabled) return;
        onSubmit(trimmed);
      }}
    >
      <Input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={PLACEHOLDER}
        aria-label="Describe a task your agency does over and over"
        disabled={disabled}
        maxLength={500}
        className="h-12 flex-1 text-body"
      />
      <Button type="submit" size="lg" loading={submitting} disabled={disabled || value.trim().length < 3}>
        Build it
        <ArrowRight className="size-4" aria-hidden="true" />
      </Button>
    </form>
  );
}
