"use client";

import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading } from "@/components/layout/page-states";
import { Badge, Button, MetricCard } from "@/components/edu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import {
  Activity,
  Building2,
  Clock,
  HardDrive,
  MapPin,
  ShieldAlert,
  Users,
  Zap,
} from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { cn } from "@/lib/utils";

type RootRecentSchool = {
  id: string;
  name: string;
  city: string | null;
  isActive: boolean;
};

type RootRecentActivity = {
  id: string;
  action: string;
  entity: string;
  createdAt: string;
  user?: {
    firstName?: string;
    lastName?: string;
  } | null;
};

type RootSummary = {
  totalSchools: number;
  totalUsers: number;
  storageUsed: string;
  recentSchools: RootRecentSchool[];
  recentActivity: RootRecentActivity[];
};

function InfraStatCard({ title, value, subValue, icon: Icon, color }: any) {
  return (
    <Card className="relative overflow-hidden border border-border/60 bg-foreground text-background shadow-xl group">
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-10", color)} />
      <CardContent className="relative z-10 p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-background/70">{title}</p>
            <h3 className="mt-2 text-3xl font-black">{value}</h3>
            {subValue ? <p className="mt-1 text-[10px] font-medium text-background/60">{subValue}</p> : null}
          </div>
          <div className={cn("rounded-2xl border border-background/20 bg-background/5 p-3 transition-transform group-hover:scale-110", color.replace("from-", "text-"))}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatActor(activity: RootRecentActivity) {
  const firstName = activity.user?.firstName || "Système";
  const lastName = activity.user?.lastName || "";
  return `${firstName} ${lastName}`.trim();
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function EmptyBlock({ label }: { label: string }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center text-center text-xs font-medium text-muted-foreground">
      {label}
    </div>
  );
}

export default function RootDashboard() {
  const { data: stats, isLoading } = useSWR<RootSummary>("/api/root/analytics/summary", fetcher);

  const recentSchools = stats?.recentSchools || [];
  const recentActivity = stats?.recentActivity || [];

  return (
    <PageGuard roles={["SUPER_ADMIN"]}>
      <PageShell className="max-w-[1600px]">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <PageHeader
            title="Console d'infrastructure"
            description="État de santé global et métriques agrégées de la plateforme EduPilot."
            breadcrumbs={[
              { label: "Tableau de bord", href: "/dashboard" },
              { label: "Pilotage réseau" },
            ]}
          />
          <div className="flex items-center gap-2">
            <Link href="/dashboard/root-control/system-map">
              <Button variant="secondary" size="sm">
                Cartographie système
              </Button>
            </Link>
            <Link href="/dashboard/root-control/ux-analytics">
              <Button variant="secondary" size="sm">
                Analytics produit
              </Button>
            </Link>
            <Badge variant="success" dot>
              Visibilité root active
            </Badge>
          </div>
        </div>

        {isLoading ? <PageLoading label="Chargement des métriques réseau…" /> : null}

        {!isLoading ? (
        <>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Établissements actifs" value={String(stats?.totalSchools ?? 0)} icon="school" />
          <MetricCard label="Utilisateurs" value={stats?.totalUsers?.toLocaleString() ?? "0"} icon="users" />
          <MetricCard label="Stockage LMS" value={stats?.storageUsed ?? "N/A"} icon="cards" />
          <MetricCard label="Disponibilité" value="N/A" icon="sparkle" />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <Card className="border border-border/60 bg-card shadow-sm lg:col-span-2">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <Building2 className="h-4 w-4 text-primary" />
                Derniers établissements provisionnés
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <EmptyBlock label="Chargement des établissements..." />
              ) : recentSchools.length === 0 ? (
                <EmptyBlock label="Aucun établissement récent." />
              ) : (
                <div className="divide-y divide-border/60">
                  {recentSchools.map((school) => (
                    <div key={school.id} className="flex items-center justify-between gap-4 p-5 transition-colors hover:bg-muted/20">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-foreground">{school.name}</p>
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {school.city || "Ville non renseignée"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest",
                          school.isActive
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {school.isActive ? "Actif" : "Inactif"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/60 bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/60">
              <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <ShieldAlert className="h-4 w-4 text-warning" />
                Activité Root
              </CardTitle>
              <span className="rounded-full bg-warning/10 px-2 py-1 text-[10px] font-black text-warning">
                {recentActivity.length}
              </span>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <EmptyBlock label="Chargement du journal root..." />
              ) : recentActivity.length === 0 ? (
                <EmptyBlock label="Aucune activité root récente." />
              ) : (
                <div className="divide-y divide-border/60">
                  {recentActivity.slice(0, 5).map((activity) => (
                    <div key={activity.id} className="space-y-2 p-4">
                      <div className="flex items-center justify-between gap-3 text-[10px] font-bold text-muted-foreground">
                        <span className="uppercase tracking-tighter">
                          {activity.action.replaceAll("_", " ")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(activity.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs font-medium leading-relaxed text-foreground/80">
                        {formatActor(activity)} a agi sur {activity.entity.toLowerCase()}.
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border border-border/60 bg-foreground text-background shadow-sm">
          <CardHeader className="border-b border-background/20">
            <CardTitle className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-background/70">
              <Activity className="h-4 w-4 text-success" />
              Journal d'audit racine
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="text-xs text-background/60">Chargement du journal...</div>
            ) : recentActivity.length === 0 ? (
              <div className="text-xs text-background/60">Aucune entrée root disponible.</div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between gap-4 border-b border-background/20 pb-3 text-xs last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-bold text-success">
                        [{activity.action}]
                      </span>
                      <span className="text-background/70">{activity.entity}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-background">{formatActor(activity)}</p>
                      <p className="text-[10px] text-background/60">{formatTimestamp(activity.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </>
        ) : null}
      </PageShell>
    </PageGuard>
  );
}
