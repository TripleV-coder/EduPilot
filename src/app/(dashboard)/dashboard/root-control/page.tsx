"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="relative overflow-hidden border-none bg-slate-900 text-white shadow-xl group">
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-10", color)} />
      <CardContent className="relative z-10 p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{title}</p>
            <h3 className="mt-2 text-3xl font-black">{value}</h3>
            {subValue ? <p className="mt-1 text-[10px] font-medium text-slate-500">{subValue}</p> : null}
          </div>
          <div className={cn("rounded-2xl border border-white/10 bg-white/5 p-3 transition-transform group-hover:scale-110", color.replace("from-", "text-"))}>
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
    <div className="flex min-h-[220px] items-center justify-center text-center text-xs font-medium text-slate-500">
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
      <div className="mx-auto max-w-[1600px] space-y-8 animate-in fade-in duration-700">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <PageHeader
            title="Console d'Infrastructure"
            description="État de santé global et métriques agrégées de la plateforme EduPilot."
          />
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-[10px] font-bold uppercase tracking-tighter text-emerald-600">
              Visibilité root active
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <InfraStatCard
            title="Tenants Actifs"
            value={stats?.totalSchools ?? (isLoading ? "..." : "0")}
            subValue="Établissements déployés"
            icon={Building2}
            color="from-blue-600"
          />
          <InfraStatCard
            title="Utilisateurs"
            value={stats?.totalUsers?.toLocaleString() ?? (isLoading ? "..." : "0")}
            subValue="Comptes actifs agrégés"
            icon={Users}
            color="from-sky-600"
          />
          <InfraStatCard
            title="Stockage LMS"
            value={stats?.storageUsed ?? (isLoading ? "..." : "N/A")}
            subValue="Mesure réellement exposée"
            icon={HardDrive}
            color="from-amber-600"
          />
          <InfraStatCard
            title="Disponibilité"
            value="N/A"
            subValue="Monitoring SLA non instrumenté"
            icon={Zap}
            color="from-emerald-600"
          />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <Card className="border-none bg-slate-50 shadow-sm lg:col-span-2">
            <CardHeader className="border-b border-slate-200">
              <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <Building2 className="h-4 w-4 text-blue-600" />
                Derniers établissements provisionnés
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <EmptyBlock label="Chargement des établissements..." />
              ) : recentSchools.length === 0 ? (
                <EmptyBlock label="Aucun établissement récent." />
              ) : (
                <div className="divide-y divide-slate-200">
                  {recentSchools.map((school) => (
                    <div key={school.id} className="flex items-center justify-between gap-4 p-5">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-900">{school.name}</p>
                        <p className="flex items-center gap-2 text-xs text-slate-500">
                          <MapPin className="h-3 w-3" />
                          {school.city || "Ville non renseignée"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest",
                          school.isActive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-600"
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

          <Card className="border-none bg-slate-50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200">
              <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <ShieldAlert className="h-4 w-4 text-orange-600" />
                Activité Root
              </CardTitle>
              <span className="rounded-full bg-orange-100 px-2 py-1 text-[10px] font-black text-orange-700">
                {recentActivity.length}
              </span>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <EmptyBlock label="Chargement du journal root..." />
              ) : recentActivity.length === 0 ? (
                <EmptyBlock label="Aucune activité root récente." />
              ) : (
                <div className="divide-y divide-slate-200">
                  {recentActivity.slice(0, 5).map((activity) => (
                    <div key={activity.id} className="space-y-2 p-4">
                      <div className="flex items-center justify-between gap-3 text-[10px] font-bold text-slate-400">
                        <span className="uppercase tracking-tighter">
                          {activity.action.replaceAll("_", " ")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(activity.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs font-medium leading-relaxed text-slate-700">
                        {formatActor(activity)} a agi sur {activity.entity.toLowerCase()}.
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-none bg-slate-900 text-slate-300 shadow-sm">
          <CardHeader className="border-b border-slate-800">
            <CardTitle className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              <Activity className="h-4 w-4 text-emerald-500" />
              Journal d'audit racine
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="text-xs text-slate-500">Chargement du journal...</div>
            ) : recentActivity.length === 0 ? (
              <div className="text-xs text-slate-500">Aucune entrée root disponible.</div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3 text-xs last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-bold text-emerald-500">
                        [{activity.action}]
                      </span>
                      <span className="text-slate-400">{activity.entity}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-100">{formatActor(activity)}</p>
                      <p className="text-[10px] text-slate-500">{formatTimestamp(activity.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageGuard>
  );
}
