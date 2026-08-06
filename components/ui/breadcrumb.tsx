"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
}

const crumbClass = cn(
  "rounded-sm text-fg-100 transition-instant transition-colors hover:text-fg-000",
  focusRing,
);

export const Breadcrumb = React.forwardRef<HTMLElement, BreadcrumbProps>(
  ({ items, className, ...props }, ref) => (
    <nav ref={ref} aria-label="Breadcrumb" className={cn("flex items-center", className)} {...props}>
      <ol className="flex items-center gap-1.5 text-label">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? <ChevronRight className="size-3.5 text-fg-300" aria-hidden="true" /> : null}
              {isLast ? (
                <span aria-current="page" className="font-medium text-fg-000">
                  {item.label}
                </span>
              ) : item.href ? (
                <a href={item.href} className={crumbClass}>
                  {item.label}
                </a>
              ) : item.onClick ? (
                <button type="button" onClick={item.onClick} className={crumbClass}>
                  {item.label}
                </button>
              ) : (
                <span className="text-fg-100">{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  ),
);
Breadcrumb.displayName = "Breadcrumb";
