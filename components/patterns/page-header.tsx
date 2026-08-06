import * as React from "react";
import { cn } from "@/lib/utils";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb";

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  breadcrumb?: BreadcrumbItem[];
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Typically a `<TabsList>` — rendered flush with the header's bottom hairline. */
  tabs?: React.ReactNode;
}

export const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ title, breadcrumb, description, actions, tabs, className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-3 border-b border-ink-400", className)} {...props}>
      {breadcrumb && breadcrumb.length > 0 ? <Breadcrumb items={breadcrumb} /> : null}
      <div className="flex items-start justify-between gap-4 pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-title-lg text-fg-000">{title}</h1>
          {description ? <p className="max-w-2xl text-body text-fg-100">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {tabs ? <div className="-mb-px">{tabs}</div> : null}
    </div>
  ),
);
PageHeader.displayName = "PageHeader";
