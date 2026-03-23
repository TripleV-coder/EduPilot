"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type PageCalloutAction = {
  label: string;
  href: string;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
};

export function PageCallout({
  icon: Icon,
  title,
  description,
  tone = "neutral",
  className,
  actions = [],
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  tone?: "neutral" | "info" | "warning" | "danger" | "success";
  className?: string;
  actions?: PageCalloutAction[];
}) {
  const toneClasses: Record<typeof tone, string> = {
    neutral: "bg-muted/30 border-border",
    info: "bg-primary/5 border-primary/15",
    warning: "bg-amber-500/5 border-amber-500/20",
    danger: "bg-destructive/5 border-destructive/20",
    success: "bg-emerald-500/5 border-emerald-500/20",
  };

  const iconClasses: Record<typeof tone, string> = {
    neutral: "text-muted-foreground/50",
    info: "text-primary",
    warning: "text-amber-600",
    danger: "text-destructive",
    success: "text-emerald-600",
  };

  return (
    <div className={cn("rounded-xl border border-dashed p-8 text-center", toneClasses[tone], className)}>
      <Icon className={cn("mx-auto mb-4 h-10 w-10", iconClasses[tone])} aria-hidden="true" />
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-prose text-sm text-muted-foreground">{description}</p>
      ) : null}
      {actions.length > 0 ? (
        <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
          {actions.map((a) => (
            <Button key={`${a.href}-${a.label}`} asChild variant={a.variant ?? "default"} className="shadow-sm">
              <Link href={a.href}>{a.label}</Link>
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

