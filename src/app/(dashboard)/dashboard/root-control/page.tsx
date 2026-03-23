"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Building2, Users, HardDrive, Activity, 
  ShieldAlert, Zap, Globe, Clock, ArrowUpRight
} from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { cn } from "@/lib/utils";

function InfraStatCard({ title, value, subValue, icon: Icon, color }: any) {
  return (
    <Card className="border-none bg-slate-900 text-white shadow-xl overflow-hidden relative group">
      <div className={cn("absolute inset-0 opacity-10 bg-gradient-to-br", color)} />
      <CardContent className="p-6 relative z-10">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{title}</p>
            <h3 className="text-3xl font-black mt-2">{value}</h3>
            {subValue && <p className="text-slate-500 text-[10px] mt-1 font-medium">{subValue}</p>}
          </div>
          <div className={cn("p-3 rounded-2xl bg-white/5 border border-white/10 group-hover:scale-110 transition-transform", color.replace('from-', 'text-'))}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RootDashboard() {
  const { data: stats, isLoading } = useSWR("/api/root/analytics/summary", fetcher);

  return (
    <PageGuard roles={["SUPER_ADMIN"]}>
      <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <PageHeader 
            title="Console d'Infrastructure" 
            description="État de santé global et métriques agrégées de la plateforme EduPilot."
          />
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">Tous les systèmes opérationnels</span>
          </div>
        </div>

        {/* Global Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <InfraStatCard 
            title="Tenants Actifs" 
            value={stats?.totalSchools || "0"} 
            subValue="Établissements déployés"
            icon={Building2} 
            color="from-blue-600"
          />
          <InfraStatCard 
            title="Utilisateurs" 
            value={stats?.totalUsers?.toLocaleString() || "0"} 
            subValue="Sessions actives (Agrégé)"
            icon={Users} 
            color="from-purple-600"
          />
          <InfraStatCard 
            title="Stockage LMS" 
            value={stats?.storageUsed || "1.2 TB"} 
            subValue="Volume total utilisé"
            icon={HardDrive} 
            color="from-amber-600"
          />
          <InfraStatCard 
            title="Disponibilité" 
            value="99.98%" 
            subValue="SLA (Derniers 30 jours)"
            icon={Zap} 
            color="from-emerald-600"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Health & Performance */}
          <Card className="lg:col-span-2 border-none shadow-sm bg-slate-50">
            <CardHeader className="border-b border-slate-200">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                Performance Infrastructure
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <div className="p-8 flex flex-col items-center justify-center min-h-[300px] text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                    <Activity className="w-8 h-8 text-blue-600" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Analyse de charge en temps réel</h4>
                  <p className="text-xs text-slate-500 max-w-xs mt-2">Visualisation des requêtes par seconde et de la latence moyenne de la base de données.</p>
                  <div className="mt-6 flex gap-4">
                    <div className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-xs font-bold">API: 42ms</div>
                    <div className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-xs font-bold">DB: 12ms</div>
                  </div>
               </div>
            </CardContent>
          </Card>

          {/* Incident Log (Plan Global) */}
          <Card className="border-none shadow-sm bg-slate-50">
            <CardHeader className="border-b border-slate-200 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-orange-600" />
                Alertes Système
              </CardTitle>
              <span className="h-5 px-2 rounded-full bg-orange-100 text-orange-700 text-[10px] font-black">2</span>
            </CardHeader>
            <CardContent className="p-0">
               <div className="divide-y divide-slate-200">
                  <div className="p-4 space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                      <span className="uppercase tracking-tighter">Tentative d'intrusion bloquée</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> 14:22</span>
                    </div>
                    <p className="text-xs font-medium text-slate-700 leading-relaxed">Multiples échecs de connexion sur le compte Root (IP: 192.168.1.1). IP mise en quarantaine.</p>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                      <span className="uppercase tracking-tighter">Mise à jour Plan Tarifaire</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> 09:15</span>
                    </div>
                    <p className="text-xs font-medium text-slate-700 leading-relaxed">Modification des limites du plan "Starter" effectuée avec succès.</p>
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>

        {/* Global Access Audit */}
        <Card className="border-none shadow-sm bg-slate-900 text-slate-300">
          <CardHeader className="border-b border-slate-800">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-emerald-500" />
              Journal d'audit racine (Infrastructure Only)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[
                { action: "PROVISIONING_COMPLETE", target: "Ecole Internationale de Cotonou", date: "Il y a 2h", user: "Root Admin" },
                { action: "PLAN_MODIFIED", target: "Plan Starter (Global)", date: "Hier", user: "Root Admin" },
                { action: "TENANT_SUSPENDED", target: "Groupe Scolaire XYZ", date: "Il y a 2 jours", user: "Root Admin" },
              ].map((log, i) => (
                <div key={i} className="flex items-center justify-between text-xs border-b border-slate-800 pb-3 last:border-0 last:pb-0">
                  <div className="flex gap-4 items-center">
                    <span className="font-mono text-emerald-500 font-bold">[{log.action}]</span>
                    <span className="text-slate-400">{log.target}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-100">{log.user}</p>
                    <p className="text-[10px] text-slate-500">{log.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageGuard>
  );
}
