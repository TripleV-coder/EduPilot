"use client";

import Link from "next/link";
import { memo } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Breadcrumb = { label: string; href?: string };

type PageHeaderProps = {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  className?: string;
};

export const PageHeader = memo(function PageHeader({ title, description, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Fil d'Ariane" className="flex items-center gap-1 text-sm text-muted-foreground">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />}
              {b.href ? (
                <Link href={b.href} className="hover:text-primary transition-colors">
                  {b.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium">{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
});
