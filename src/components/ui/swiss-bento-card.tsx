"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface SwissBentoCardProps {
  title: string;
  value?: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: "default" | "accent" | "muted" | "highlight";
  size?: "sm" | "md" | "lg" | "xl";
  children?: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}

export function SwissBentoCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
  size = "md",
  children,
  className,
  footer,
}: SwissBentoCardProps) {
  const variantStyles = {
    default: "bg-[hsl(var(--surface-base))] border-border",
    accent: "bg-primary border-primary text-primary-foreground",
    muted: "bg-muted border-border",
    highlight: "bg-[hsl(var(--sidebar-bg))] border-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))]",
  };

  const sizeStyles = {
    sm: "p-3",
    md: "p-4",
    lg: "p-5",
    xl: "p-6",
  };

  const isLight = variant === "default" || variant === "muted";

  return (
    <div
      className={cn(
        "border rounded-sm transition-all hover:shadow-sm",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wider",
              isLight ? "text-text-secondary" : "text-[hsl(var(--sidebar-muted))]"
            )}
          >
            {title}
          </h3>
          
          {value !== undefined && (
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              {value}
            </p>
          )}
          
          {subtitle && (
            <p
              className={cn(
                "text-[11px] mt-0.5",
                isLight ? "text-text-secondary" : "text-[hsl(var(--sidebar-muted))]"
              )}
            >
              {subtitle}
            </p>
          )}
        </div>

        {Icon && (
          <div
            className={cn(
              "flex-shrink-0 p-2 rounded-sm",
              variant === "accent" && "bg-white/10",
              variant === "highlight" && "bg-[hsl(var(--sidebar-hover))]",
              variant === "default" && "bg-muted",
              variant === "muted" && "bg-[hsl(var(--surface-base))]"
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4",
                isLight ? "text-text-secondary" : "text-[hsl(var(--sidebar-fg))]"
              )}
            />
          </div>
        )}
      </div>

      {/* Content */}
      {children && <div className="mt-3">{children}</div>}

      {/* Footer */}
      {footer && (
        <div
          className={cn(
            "mt-3 pt-3 border-t",
            isLight ? "border-border" : "border-[hsl(var(--sidebar-border))]"
          )}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

// Grid layout component for bento-style layouts
interface SwissBentoGridProps {
  children: React.ReactNode;
  cols?: 2 | 3 | 4;
  className?: string;
}

export function SwissBentoGrid({
  children,
  cols = 4,
  className,
}: SwissBentoGridProps) {
  const colsClass = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-3", colsClass[cols], className)}>
      {children}
    </div>
  );
}

export default SwissBentoCard;
