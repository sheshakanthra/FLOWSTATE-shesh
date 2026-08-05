"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";

export interface ComboboxItem {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ComboboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange"> {
  items: ComboboxItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  emptyMessage?: string;
}

export const Combobox = React.forwardRef<HTMLInputElement, ComboboxProps>(
  (
    {
      items,
      value: valueProp,
      defaultValue,
      onValueChange,
      emptyMessage = "No results found.",
      placeholder = "Search...",
      className,
      id,
      disabled,
      "aria-label": ariaLabel,
      ...inputProps
    },
    forwardedRef,
  ) => {
    const [open, setOpen] = React.useState(false);
    const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue ?? "");
    const value = valueProp ?? uncontrolledValue;
    const selected = items.find((item) => item.value === value);

    const [query, setQuery] = React.useState(selected?.label ?? "");
    const [activeIndex, setActiveIndex] = React.useState(-1);
    const listboxId = React.useId();
    const inputRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);

    React.useEffect(() => {
      setQuery(selected?.label ?? "");
    }, [value, selected?.label]);

    const filtered =
      query.trim() === "" || query === selected?.label
        ? items
        : items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

    function commit(item: ComboboxItem) {
      if (item.disabled) return;
      if (valueProp === undefined) setUncontrolledValue(item.value);
      onValueChange?.(item.value);
      setQuery(item.label);
      setOpen(false);
      setActiveIndex(-1);
      inputRef.current?.focus();
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setOpen(true);
        setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setOpen(true);
        setActiveIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === "Enter") {
        if (open && activeIndex >= 0 && filtered[activeIndex]) {
          event.preventDefault();
          commit(filtered[activeIndex]);
        }
      } else if (event.key === "Escape") {
        setOpen(false);
        setActiveIndex(-1);
      }
    }

    const activeItem = activeIndex >= 0 ? filtered[activeIndex] : undefined;

    return (
      <PopoverPrimitive.Root open={open && filtered.length > 0} onOpenChange={setOpen}>
        <PopoverPrimitive.Anchor asChild>
          <div className="relative">
            <input
              ref={inputRef}
              id={id}
              aria-label={ariaLabel}
              role="combobox"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={activeItem ? `${listboxId}-${activeItem.value}` : undefined}
              disabled={disabled}
              placeholder={placeholder}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
                setActiveIndex(-1);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              className={cn(
                "h-control-height w-full rounded-sm border border-ink-400 bg-ink-100 pl-3 pr-9 text-body text-fg-000",
                "placeholder:text-fg-300",
                "transition-instant transition-colors",
                "hover:border-ink-500",
                "aria-invalid:border-red-line aria-invalid:text-red-fg",
                "disabled:cursor-not-allowed disabled:bg-ink-050 disabled:text-fg-300 disabled:opacity-50",
                focusRing,
                className,
              )}
              {...inputProps}
            />
            <ChevronsUpDown
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-200"
              aria-hidden="true"
            />
          </div>
        </PopoverPrimitive.Anchor>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            aria-label={ariaLabel ? `${ariaLabel} suggestions` : "Suggestions"}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onInteractOutside={(event) => {
              if (event.target === inputRef.current) event.preventDefault();
            }}
            align="start"
            sideOffset={4}
            className="z-50 w-(--radix-popover-trigger-width) overflow-hidden rounded-md border border-ink-500/60 bg-ink-300 text-fg-000 shadow-floating backdrop-blur-[var(--blur-floating)]"
          >
            <ul id={listboxId} role="listbox" className="max-h-64 overflow-auto p-1">
              {filtered.length === 0 ? (
                <li className="px-2 py-1.5 text-body text-fg-100">{emptyMessage}</li>
              ) : (
                filtered.map((item, index) => (
                  <li
                    key={item.value}
                    id={`${listboxId}-${item.value}`}
                    role="option"
                    aria-selected={item.value === value}
                    aria-disabled={item.disabled}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => commit(item)}
                    className={cn(
                      "relative flex h-control-height cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-body select-none",
                      "transition-instant transition-colors",
                      index === activeIndex && "bg-ink-200",
                      item.disabled && "pointer-events-none text-fg-300 opacity-50",
                    )}
                  >
                    <span className="absolute left-2 flex size-4 items-center justify-center">
                      {item.value === value ? (
                        <Check className="size-4 text-blue-fg" aria-hidden="true" />
                      ) : null}
                    </span>
                    {item.label}
                  </li>
                ))
              )}
            </ul>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    );
  },
);

Combobox.displayName = "Combobox";
