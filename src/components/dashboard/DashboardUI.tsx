"use client";

import { ComponentType } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowUpRight, ArrowDownRight, 
  FileText, CheckSquare, AlertCircle, MessageSquare, CheckCircle, Activity,
  PenTool
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  delta?: string | null;
  icon: ComponentType<{ className?: string }>;
  trend?: "up" | "down";
}

export function StatCard({ title, value, delta, icon: Icon, trend }: StatCardProps) {
  return (
    <Card className="dashboard-block kpi-card border-none bg-card shadow-sm overflow-hidden relative group hover:shadow-md transition-all">
      <CardContent className="p-5">
        <div className="flex justify-between items-start">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <h3 className="text-3xl font-bold tracking-tight text-foreground">{value}</h3>
          </div>
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
        {delta && (
          <div className="mt-4 flex items-center gap-1.5">
            {trend === "up" ? (
              <ArrowUpRight className="w-4 h-4 text-[hsl(var(--success))]" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-destructive" />
            )}
            <span className={cn(
              "text-xs font-bold",
              trend === "up" ? "text-[hsl(var(--success))]" : "text-destructive"
            )}>
              {delta}
            </span>
            <span className="text-xs text-muted-foreground">vs période préc.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface QuickActionProps {
  label: string;
  icon: ComponentType<{ className?: string }>;
  href: string;
  color: string;
}

export function QuickAction({ label, icon: Icon, href, color }: QuickActionProps) {
  return (
    <Link 
      href={href}
      className="dashboard-panel flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border border-border/50 bg-card hover:bg-muted/50 hover:border-primary/30 transition-all group shadow-sm hover:shadow-md"
    >
      <div className={cn("p-3 rounded-xl bg-background border border-border group-hover:scale-110 transition-transform", color)}>
        <Icon className="w-6 h-6" />
      </div>
      <span className="text-xs font-bold text-center leading-tight tracking-tight">{label}</span>
    </Link>
  );
}

interface ActivityItemProps {
  type: "grade" | "attendance" | "incident" | "message" | "success" | "info" | string;
  title: string;
  description: string;
  time: string;
  entityLink?: string;
}

export function ActivityItem({ type, title, description, time, entityLink }: ActivityItemProps) {
  const icons: Record<string, { icon: ComponentType<{ className?: string }>; color: string; bg: string }> = {
    grade: { icon: FileText, color: "text-[hsl(var(--info))]", bg: "bg-[hsl(var(--info-bg))]" },
    attendance: { icon: CheckSquare, color: "text-[hsl(var(--success))]", bg: "bg-[hsl(var(--success-bg))]" },
    incident: { icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10" },
    message: { icon: MessageSquare, color: "text-[hsl(var(--accent))]", bg: "bg-[hsl(var(--accent))]/12" },
    success: { icon: CheckCircle, color: "text-[hsl(var(--success))]", bg: "bg-[hsl(var(--success-bg))]" },
    info: { icon: Activity, color: "text-[hsl(var(--info))]", bg: "bg-[hsl(var(--info-bg))]" },
  };
  const config = icons[type] || icons.grade;
  const IconComponent = config.icon;
  
  return (
    <div className="dashboard-panel flex gap-4 py-4 border-b border-border/50 last:border-0 hover:bg-muted/5 transition-colors px-2 rounded-lg">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-border/50 bg-background shadow-sm", config.bg)}>
        <IconComponent className={cn("w-5 h-5", config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <p className="text-sm font-bold text-foreground truncate">{title}</p>
          <span className="text-xs text-muted-foreground whitespace-nowrap bg-muted/50 px-2 py-0.5 rounded-full">{time}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-1 leading-relaxed">{description}</p>
        {entityLink && (
          <Link href={entityLink} className="text-xs font-bold text-primary hover:underline mt-2 inline-block uppercase tracking-wider">
            Consulter
          </Link>
        )}
      </div>
    </div>
  );
}

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
  >
    <path d="m12 19 7-7 3 3-7 7-3-3z"/>
    <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
    <path d="m2 2 5 5"/>
    <path d="m11 11 5 5"/>
  </svg>
);
