"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionToolbarProps = {
  title?: string;
  description?: string;
  leading?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function SectionToolbar({
  title,
  description,
  leading,
  actions,
  className,
}: SectionToolbarProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 sm:p-5",
        "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between",
        className
      )}
    >
      <div className="space-y-1">
        {title ? <h3 className="text-sm font-bold uppercase tracking-wider">{title}</h3> : null}
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
        {leading ? <div className="w-full sm:w-auto">{leading}</div> : null}
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
