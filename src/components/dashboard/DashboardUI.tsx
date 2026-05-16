"use client";

/**
 * Dashboard UI primitives — StatCard, QuickAction, ActivityItem
 * Enhanced with Framer Motion animations, glassmorphism, and premium UX.
 */

import { ComponentType } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowUpRight, ArrowDownRight,
  FileText, CheckSquare, AlertCircle, MessageSquare, CheckCircle, Activity,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { trackUxEvent } from "@/lib/ux/telemetry";
import { motion, type Variants } from "framer-motion";

/* ─── Shared animation variants ──── */

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
  },
};

const numberVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.1 },
  },
};

/* ─── StatCard (KPI) ──── */

interface StatCardProps {
  title: string;
  value: string | number;
  delta?: string | null;
  icon: ComponentType<{ className?: string }>;
  trend?: "up" | "down";
}

export function StatCard({ title, value, delta, icon: Icon, trend }: StatCardProps) {
  return (
    <motion.div variants={cardVariants}>
      <Card className="group relative overflow-hidden border-border/40 bg-card/90 backdrop-blur-sm shadow-sm hover:shadow-lg hover:border-primary/20 transition-all duration-300 ease-out cursor-default">
        {/* Subtle gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <CardContent className="relative p-5">
          <div className="flex justify-between items-start">
            <div className="space-y-1.5">
              <p className="text-[13px] font-medium text-muted-foreground tracking-wide">{title}</p>
              <motion.h3
                variants={numberVariants}
                className="text-3xl font-bold tracking-tight text-foreground font-[var(--font-display)]"
              >
                {value}
              </motion.h3>
            </div>
            <div className="p-2.5 rounded-xl bg-primary/8 dark:bg-primary/15 border border-primary/15 group-hover:bg-primary/12 group-hover:scale-105 transition-all duration-300">
              <Icon className="w-5 h-5 text-primary" />
            </div>
          </div>

          {delta && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="mt-4 flex items-center gap-1.5"
            >
              <div className={cn(
                "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold",
                trend === "up"
                  ? "bg-success/10 text-success dark:bg-success/20"
                  : "bg-destructive/10 text-destructive dark:bg-destructive/20"
              )}>
                {trend === "up" ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                {delta}
              </div>
              <span className="text-[11px] text-muted-foreground">vs periode prec.</span>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── QuickAction ──── */

interface QuickActionProps {
  label: string;
  icon: ComponentType<{ className?: string }>;
  href: string;
  color: string;
}

export function QuickAction({ label, icon: Icon, href, color }: QuickActionProps) {
  return (
    <motion.div variants={cardVariants}>
      <Link
        href={href}
        prefetch
        onClick={() => trackUxEvent("quick_action_click", { label, href })}
        className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm hover:bg-muted/50 hover:border-primary/30 group shadow-sm hover:shadow-md cursor-pointer transition-all duration-300 ease-out"
      >
        <div
          className={cn(
            "p-3 rounded-xl bg-background/80 border border-border/50 shadow-sm",
            "group-hover:scale-110 group-hover:shadow-md transition-all duration-300 ease-out",
            color
          )}
        >
          <Icon className="w-6 h-6" />
        </div>
        <span className="text-xs font-bold text-center leading-tight tracking-tight">
          {label}
        </span>
      </Link>
    </motion.div>
  );
}

/* ─── ActivityItem ──── */

interface ActivityItemProps {
  type: "grade" | "attendance" | "incident" | "message" | "success" | "info" | string;
  title: string;
  description: string;
  time: string;
  entityLink?: string;
}

const activityIcons: Record<string, { icon: ComponentType<{ className?: string }>; color: string; bg: string }> = {
  grade:      { icon: FileText,      color: "text-[hsl(var(--info))]",       bg: "bg-[hsl(var(--info-bg))]" },
  attendance: { icon: CheckSquare,   color: "text-[hsl(var(--success))]",    bg: "bg-[hsl(var(--success-bg))]" },
  incident:   { icon: AlertCircle,   color: "text-destructive",              bg: "bg-destructive/10" },
  message:    { icon: MessageSquare, color: "text-[hsl(var(--accent))]",     bg: "bg-[hsl(var(--accent))]/12" },
  success:    { icon: CheckCircle,   color: "text-[hsl(var(--success))]",    bg: "bg-[hsl(var(--success-bg))]" },
  info:       { icon: Activity,      color: "text-[hsl(var(--info))]",       bg: "bg-[hsl(var(--info-bg))]" },
};

export function ActivityItem({ type, title, description, time, entityLink }: ActivityItemProps) {
  const config = activityIcons[type] || activityIcons.grade;
  const IconComponent = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="flex gap-4 py-3.5 border-b border-border/30 last:border-0 hover:bg-muted/5 transition-colors px-2 rounded-lg group"
    >
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
        "border border-border/30 bg-background/80 shadow-sm backdrop-blur-sm",
        "group-hover:scale-105 transition-transform duration-200",
        config.bg
      )}>
        <IconComponent className={cn("w-4.5 h-4.5", config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <p className="text-sm font-semibold text-foreground truncate">{title}</p>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap bg-muted/40 dark:bg-muted/20 px-2 py-0.5 rounded-full">
            {time}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 leading-relaxed">
          {description}
        </p>
        {entityLink && (
          <Link
            href={entityLink}
            className="text-xs font-bold text-primary hover:text-primary/80 hover:underline mt-1.5 inline-flex items-center gap-1 transition-colors"
          >
            Consulter
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        )}
      </div>
    </motion.div>
  );
}

/* ─── PenTool Icon (custom) ──── */

export const PenToolIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="m12 19 7-7 3 3-7 7-3-3z"/>
    <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
    <path d="m2 2 5 5"/>
    <path d="m11 11 5 5"/>
  </svg>
);
