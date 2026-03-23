"use client";

import { useState, useMemo } from "react";
import { 
  Users, GraduationCap, CheckCircle, AlertCircle, 
  TrendingUp, CheckSquare, MessageSquare, 
  FileText, Activity, Calendar, LayoutGrid, Building2, Zap, Settings, Target, HardDrive
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { fr } from "date-fns/locale/fr";
import { StatCard, QuickAction, ActivityItem, PenToolIcon } from "./DashboardUI";
import { SubjectRadarChart } from "@/components/charts/SubjectRadarChart";
import { PerformanceBarChart } from "@/components/charts/PerformanceBarChart";
import { formatAction, translateEntity } from "@/lib/utils/entity-translator";
import { t } from "@/lib/i18n";

interface DashboardOverviewProps {
  analytics: {
    totalSchools?: string | number;
    totalStudents?: string | number;
    studentGrowth?: number | null;
    totalUsers?: string | number;
    attendanceRate?: number;
    attendanceGrowth?: number | null;
    storageUsed?: string;
    averageGrade?: number;
    averageGrowth?: number | null;
    activeAlerts?: number;
    recentActivity?: {
      id: string;
      action: string;
      entity: string;
      createdAt: string;
      user: { firstName: string; lastName: string; };
    }[];
    performanceDistribution?: {
      excellent: number;
      veryGood: number;
      good: number;
      average: number;
      insufficient: number;
      weak: number;
    };
    riskDistribution?: {
      low: number;
      medium: number;
      high: number;
      critical: number;
    };
    atRiskStudents?: {
      id: string;
      name: string;
      className: string;
      riskLevel: string;
      average: number;
    }[];
    recentSchools?: {
      id: string;
      name: string;
      city?: string | null;
    }[];
    classSummary?: {
      id?: string;
      name: string;
      studentCount?: number;
      average: number;
    }[];
    subjectSummary?: {
      name: string;
      average: number;
    }[];
    monthlyTrend?: {
      name: string;
      value: number;
    }[];
  } | null;
  isSuperAdminGlobal: boolean;
}

export default function DashboardOverviewContent({ analytics, isSuperAdminGlobal }: DashboardOverviewProps) {
  const [activeTab, setActiveTab] = useState("global");
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return t("dashboardOverview.greeting.morning");
    if (h < 18) return t("dashboardOverview.greeting.afternoon");
    return t("dashboardOverview.greeting.evening");
  }, []);
  const setupProgress = useMemo(() => {
    let score = 0;
    if (Number(analytics?.totalStudents || 0) > 0) score += 25;
    if (Number(analytics?.attendanceRate || 0) > 0) score += 25;
    if (Array.isArray(analytics?.subjectSummary) && analytics.subjectSummary.length > 0) score += 25;
    if (Array.isArray(analytics?.classSummary) && analytics.classSummary.length > 0) score += 25;
    return Math.min(100, score);
  }, [analytics]);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <Card className="dashboard-block border-border bg-card/90" data-reveal>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-foreground">
              <span className="font-semibold">{greeting}</span>, {t("dashboardOverview.statusSuffix")}
            </p>
            <div className="min-w-[260px]">
              <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Progression de configuration</span>
                <span>{setupProgress}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-[hsl(var(--success))] transition-all duration-500" style={{ width: `${setupProgress}%` }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title={isSuperAdminGlobal ? "Total Établissements" : "Effectif Total"} 
          value={isSuperAdminGlobal ? (analytics?.totalSchools || "0") : (analytics?.totalStudents || "0")} 
          delta={isSuperAdminGlobal ? null : (analytics?.studentGrowth ? `${analytics.studentGrowth > 0 ? '+' : ''}${analytics.studentGrowth}%` : null)} 
          trend={analytics?.studentGrowth && analytics.studentGrowth < 0 ? "down" : "up"} 
          icon={isSuperAdminGlobal ? Building2 : Users} 
        />
        <StatCard 
          title={isSuperAdminGlobal ? "Utilisateurs Totaux" : "Taux de présence"} 
          value={isSuperAdminGlobal ? (analytics?.totalUsers || "0") : `${analytics?.attendanceRate?.toFixed(1) || "0"}%`} 
          delta={isSuperAdminGlobal ? null : (analytics?.attendanceGrowth ? `${analytics.attendanceGrowth > 0 ? '+' : ''}${analytics.attendanceGrowth}%` : null)} 
          trend={analytics?.attendanceGrowth && analytics.attendanceGrowth < 0 ? "down" : "up"} 
          icon={isSuperAdminGlobal ? Users : CheckCircle} 
        />
        <StatCard 
          title={isSuperAdminGlobal ? "Volume Stockage" : "Moyenne Générale"} 
          value={isSuperAdminGlobal ? (analytics?.storageUsed || "0 GB") : `${analytics?.averageGrade?.toFixed(1) || "0"}/20`} 
          delta={isSuperAdminGlobal ? null : (analytics?.averageGrowth ? `${analytics.averageGrowth > 0 ? '+' : ''}${analytics.averageGrowth}` : null)} 
          trend={analytics?.averageGrowth && analytics.averageGrowth < 0 ? "down" : "up"} 
          icon={isSuperAdminGlobal ? HardDrive : GraduationCap} 
        />
        <StatCard 
          title={isSuperAdminGlobal ? "Écoles Actives" : "Alertes Actives"} 
          value={isSuperAdminGlobal ? (analytics?.totalSchools || "0") : (analytics?.activeAlerts || "0")} 
          icon={isSuperAdminGlobal ? Activity : AlertCircle} 
          trend="up"
        />
      </div>

      {/* Main Content with Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/50 pb-1">
          <TabsList className="bg-transparent h-auto p-0 gap-6 rounded-none">
            {["global", "risks", "classes", "subjects"].map((tab) => {
              if (isSuperAdminGlobal && (tab === "risks" || tab === "subjects")) return null;
              return (
                <TabsTrigger
                  key={tab}
                  value={tab} 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-1.5 text-sm font-semibold tracking-tight"
                >
                  {tab === "global" ? "Vue Globale" : 
                   tab === "risks" ? "Risques & Interventions" :
                   tab === "classes" ? (isSuperAdminGlobal ? "Établissements" : "Classes") : "Matières"}
                </TabsTrigger>
              );
            })}
          </TabsList>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold uppercase tracking-tight">
              <Calendar className="w-3.5 h-3.5 mr-2" />
              Exporter
            </Button>
          </div>
        </div>

        <TabsContent value="global" className="mt-0 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Activité Récente */}
            <Card className="border-none shadow-none bg-muted/20">
              <div className="p-4 border-b border-border/50 flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  {isSuperAdminGlobal ? "Journal Infrastructure" : "Activité Récente"}
                </h3>
                <Link href={isSuperAdminGlobal ? "/dashboard/root-control/logs" : "/dashboard/audit-logs"} className="text-[10px] font-bold text-primary uppercase hover:underline">
                  Tout voir
                </Link>
              </div>
              <CardContent className="p-4 pt-0">
                {analytics?.recentActivity && analytics.recentActivity.length > 0 ? (
                  analytics.recentActivity.map((log) => {
                    let type: "info" | "success" | "incident" | "grade" | "attendance" = "info";
                    
                    const actionName = log.action || "";
                    const entityName = log.entity || "";
                    
                    let title = formatAction(actionName, entityName);
                    let description = `${log.user?.firstName || "System"} ${log.user?.lastName || ""} a effectué l'action sur ${translateEntity(entityName).toLowerCase()}.`;

                    const aLower = actionName.toLowerCase();
                    const eLower = entityName.toLowerCase();

                    if (aLower.includes("login") && !aLower.includes("fail")) {
                      description = `${log.user?.firstName || "System"} ${log.user?.lastName || ""} s'est connecté à la plateforme.`;
                      type = "success";
                    } else if (aLower.includes("create")) {
                      type = "success";
                    } else if (aLower.includes("update")) {
                      type = "info";
                    } else if (aLower.includes("delete")) {
                       description = `Action critique effectuée par ${log.user?.firstName || "System"} sur ${translateEntity(entityName).toLowerCase()}.`;
                      type = "incident";
                    } else if (aLower.includes("login_fail")) {
                       description = `Échec de connexion par ${log.user?.firstName || "System"}.`;
                       type = "incident";
                    }

                    if (eLower === "grade") type = "grade";
                    if (eLower === "attendance") type = "attendance";
                    
                    return (
                      <ActivityItem 
                        key={log.id}
                        type={type} 
                        title={title}
                        description={description}
                        time={formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: fr })}
                      />
                    );
                  })
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-center opacity-50">
                    <Activity className="w-8 h-8 mb-2" />
                    <p className="text-xs font-bold uppercase tracking-widest">Aucune activité récente</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Accès Rapides & Mini Charts */}
            <div className="space-y-6">
              {!isSuperAdminGlobal ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-4">
                  <QuickAction label="Saisir l'appel" icon={CheckSquare} href="/dashboard/attendance" color="text-emerald-500" />
                  <QuickAction label="Entrer des notes" icon={PenToolIcon} href="/dashboard/grades/entry" color="text-blue-500" />
                  <QuickAction label="Messages" icon={MessageSquare} href="/dashboard/messages" color="text-purple-500" />
                  <QuickAction label="Bulletins" icon={FileText} href="/dashboard/grades/bulletins" color="text-amber-500" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <QuickAction label="Gérer Écoles" icon={Building2} href="/dashboard/root-control/schools" color="text-blue-500" />
                  <QuickAction label="Utilisateurs" icon={Users} href="/dashboard/root-control/users" color="text-purple-500" />
                  <QuickAction label="Monitoring" icon={Activity} href="/dashboard/root-control/monitoring" color="text-emerald-500" />
                  <QuickAction label="Paramètres" icon={Settings} href="/dashboard/settings" color="text-slate-500" />
                </div>
              )}
              
              <Card className="border-none shadow-none bg-muted/20">
                <div className="p-4 border-b border-border/50">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    {isSuperAdminGlobal ? "Santé Infrastructure" : "Performance par matière"}
                  </h3>
                </div>
                <CardContent className="p-4">
                  {isSuperAdminGlobal ? (
                    <div className="h-[200px] flex flex-col items-center justify-center text-center space-y-2">
                      <Zap className="w-8 h-8 text-emerald-500 animate-pulse" />
                      <p className="text-sm font-bold">Systèmes Opérationnels</p>
                      <p className="text-[11px] text-muted-foreground">Charge CPU: 12% | Latence DB: 8ms</p>
                    </div>
                  ) : (
                    analytics?.performanceDistribution ? (
                      <PerformanceBarChart data={analytics.performanceDistribution} />
                    ) : (
                      <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                        Aucune donnée disponible
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="risks" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-none shadow-none bg-muted/20">
               <div className="p-4 border-b border-border/50 flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-destructive" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Élèves sous surveillance renforcée</h3>
               </div>
               <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 text-muted-foreground uppercase font-bold text-[10px]">
                        <tr>
                          <th className="px-4 py-3 text-left">Élève</th>
                          <th className="px-4 py-3 text-left">Classe</th>
                          <th className="px-4 py-3 text-center">Score Risque</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {analytics?.atRiskStudents?.slice(0, 5).map((s) => (
                          <tr key={s.id} className="hover:bg-background/50 transition-colors">
                            <td className="px-4 py-3 font-bold">{s.name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{s.className}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-bold text-[10px]">
                                {s.riskLevel?.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link href={`/dashboard/students/${s.id}`} className="text-primary font-bold hover:underline">Fiche</Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </CardContent>
            </Card>
            <div className="space-y-6">
              <Card className="border-none shadow-none bg-muted/20 p-4 flex flex-col items-center justify-center text-center">
                <AlertCircle className="w-8 h-8 text-destructive mb-3" />
                <h4 className="text-sm font-bold">Alertes de paiement</h4>
                <p className="text-xs text-muted-foreground mt-1">12 familles présentent un retard de paiement critique pour le T2.</p>
                <Button variant="destructive" size="sm" className="mt-4 h-7 text-[10px] font-bold uppercase w-full">Gérer les dettes</Button>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="classes" className="mt-0">
          <Card className="border-none shadow-none bg-muted/20">
             <div className="p-4 border-b border-border/50 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {isSuperAdminGlobal ? "Derniers Établissements Enregistrés" : "Top Classes par Performance"}
                </h3>
             </div>
             <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-muted-foreground uppercase font-bold text-[10px]">
                      <tr>
                        <th className="px-4 py-3 text-left">{isSuperAdminGlobal ? "Établissement" : "Classe"}</th>
                        <th className="px-4 py-3 text-left">{isSuperAdminGlobal ? "Ville" : "Effectif"}</th>
                        <th className="px-4 py-3 text-center">{isSuperAdminGlobal ? "Statut" : "Moyenne"}</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {isSuperAdminGlobal ? (
                        (analytics?.recentSchools || []).map((school) => (
                          <tr key={school.id} className="hover:bg-background/50 transition-colors">
                            <td className="px-4 py-3 font-bold">{school.name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{school.city}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-[10px]">ACTIF</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link href={`/dashboard/root-control/schools/${school.id}`} className="text-primary font-bold hover:underline">Détails</Link>
                            </td>
                          </tr>
                        ))
                      ) : (
                        (analytics?.classSummary || []).map((classe, i) => (
                          <tr key={classe.id || i} className="hover:bg-background/50 transition-colors">
                            <td className="px-4 py-3 font-bold">{classe.name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{classe.studentCount}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-bold text-primary">{classe.average}/20</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link href={`/dashboard/classes/${classe.id}`} className="text-primary font-bold hover:underline">Détails</Link>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
             </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subjects" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-none shadow-none bg-muted/20">
              <div className="p-4 border-b border-border/50 flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Moyennes par Matière</h3>
              </div>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-muted-foreground uppercase font-bold text-[10px]">
                      <tr>
                        <th className="px-4 py-3 text-left">Matière</th>
                        <th className="px-4 py-3 text-center">Moyenne</th>
                        <th className="px-4 py-3 text-right">Progression</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {analytics?.subjectSummary?.map((s, i: number) => (
                        <tr key={i} className="hover:bg-background/50 transition-colors">
                          <td className="px-4 py-3 font-bold">{s.name}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-bold text-primary">{s.average}/20</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-muted-foreground font-medium">—</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-none bg-muted/20">
              <div className="p-4 border-b border-border/50">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Vue d'ensemble Radar</h3>
              </div>
              <CardContent className="p-4 flex items-center justify-center">
                {analytics?.subjectSummary ? (
                  <SubjectRadarChart data={analytics.subjectSummary} />
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                    Aucune donnée disponible
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
