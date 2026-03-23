"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ShieldAlert, AlertCircle, 
  ArrowRight, Filter, Download
} from "lucide-react";
import { RiskMatrix, type RiskMatrixPoint } from "@/components/charts/RiskMatrix";
import { cn } from "@/lib/utils";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { t } from "@/lib/i18n";

type AnalyticsStudent = {
  studentId: string;
  studentName: string;
  averageGrade: number | null;
  attendanceRate: number | null;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
  student?: {
    enrollments?: Array<{
      class?: {
        id: string;
        name: string;
      };
    }>;
  };
};

type IncidentApiItem = {
  studentId: string;
};

type RiskRow = {
  studentId: string;
  name: string;
  className: string;
  riskScore: number;
  trend: "up" | "stable" | "down";
  status: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  attendanceRate: number | null;
  averageGrade: number | null;
  incidentsCount: number;
};

function scoreToStatus(score: number): RiskRow["status"] {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

function computeRiskScore(input: {
  averageGrade: number | null;
  attendanceRate: number | null;
  incidentsCount: number;
  riskLevelHint: AnalyticsStudent["riskLevel"];
}) {
  const avg = input.averageGrade ?? 20;
  const attendance = input.attendanceRate ?? 100;
  const incidents = input.incidentsCount;

  let score = 0;
  score += (20 - avg) * 3;
  score += (100 - attendance) * 0.8;
  score += Math.min(30, Math.sqrt(incidents) * 10);

  if (input.riskLevelHint === "CRITICAL") score = Math.max(score, 85);
  if (input.riskLevelHint === "HIGH") score = Math.max(score, 70);
  if (input.riskLevelHint === "MEDIUM") score = Math.max(score, 45);

  return Math.max(0, Math.min(100, Math.round(score)));
}

export default function AlertsRisksPage() {
  const [classId, setClassId] = useState<string>("all");

  const markStudentTransition = (studentId: string) => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem("edupilot-student-transition", studentId);
  };

  const { data: classesData } = useSWR("/api/classes?limit=200", fetcher);
  const classes = classesData?.data || [];

  const analyticsUrl = classId === "all"
    ? "/api/analytics/students?latestOnly=true&limit=200"
    : `/api/analytics/students?latestOnly=true&limit=200&classId=${classId}`;
  const incidentsUrl = classId === "all"
    ? "/api/incidents?limit=200"
    : `/api/incidents?limit=200&classId=${classId}`;

  const { data: analyticsData, isLoading: analyticsLoading } = useSWR<AnalyticsStudent[]>(analyticsUrl, fetcher);
  const { data: incidentsData, isLoading: incidentsLoading } = useSWR<{ incidents: IncidentApiItem[] }>(incidentsUrl, fetcher);

  const riskRows = useMemo<RiskRow[]>(() => {
    const analytics = Array.isArray(analyticsData) ? analyticsData : [];
    const incidents = incidentsData?.incidents || [];

    const incidentsByStudent = incidents.reduce<Record<string, number>>((acc, item) => {
      acc[item.studentId] = (acc[item.studentId] || 0) + 1;
      return acc;
    }, {});

    return analytics
      .map((row) => {
        const incidentCount = incidentsByStudent[row.studentId] || 0;
        const score = computeRiskScore({
          averageGrade: row.averageGrade,
          attendanceRate: row.attendanceRate,
          incidentsCount: incidentCount,
          riskLevelHint: row.riskLevel,
        });

        const className = row.student?.enrollments?.[0]?.class?.name || "Non assignée";
        const trend: RiskRow["trend"] = score >= 70 ? "up" : score <= 30 ? "down" : "stable";

        return {
          studentId: row.studentId,
          name: row.studentName,
          className,
          riskScore: score,
          trend,
          status: scoreToStatus(score),
          attendanceRate: row.attendanceRate,
          averageGrade: row.averageGrade,
          incidentsCount: incidentCount,
        };
      })
      .sort((a, b) => b.riskScore - a.riskScore);
  }, [analyticsData, incidentsData]);

  const topAlerts = riskRows.filter((r) => r.riskScore >= 60).slice(0, 5);
  const isLoading = analyticsLoading || incidentsLoading;
  const matrixPoints = useMemo<RiskMatrixPoint[]>(
    () =>
      riskRows.map((row) => ({
        id: row.studentId,
        name: row.name,
        className: row.className,
        dropoutScore: row.riskScore,
        failureScore:
          row.averageGrade == null ? row.riskScore : Math.max(0, Math.min(100, Math.round((20 - row.averageGrade) * 5))),
      })),
    [riskRows]
  );

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader 
          title="Module de Prévention" 
          description="Anticipez le décrochage scolaire et les risques académiques par une analyse prédictive."
        />
        <div className="flex items-center gap-2">
           <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="w-[220px] h-8 text-[11px] font-bold uppercase">
              <SelectValue placeholder="Toutes les classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les classes</SelectItem>
              {classes.map((classItem: any) => (
                <SelectItem key={classItem.id} value={classItem.id}>
                  {classItem.name}
                </SelectItem>
              ))}
            </SelectContent>
           </Select>
           <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold uppercase" onClick={() => setClassId("all")}>
             <Filter className="w-3.5 h-3.5 mr-2" />
             {t("common.reset")} filtres
           </Button>
          <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold uppercase">
             <Download className="w-3.5 h-3.5 mr-2" />
             {t("common.export")}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Colonne Gauche: Matrice (8/12) */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-none shadow-none bg-muted/20">
            <CardHeader className="p-4 border-b border-border/50">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-destructive" />
                  Matrice des Risques (Décrochage vs Échec)
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
               <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                 <div className="md:col-span-7">
                    <RiskMatrix students={matrixPoints} />
                 </div>
                 <div className="md:col-span-5 space-y-4">
                    <div className="p-4 rounded-xl bg-background/50 border border-border/50">
                       <h4 className="text-xs font-bold uppercase tracking-tight mb-2">Légende Matrice</h4>
                       <div className="space-y-3">
                          <div className="flex items-start gap-3">
                             <div className="w-3 h-3 rounded-full bg-destructive animate-pulse mt-0.5" />
                             <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold leading-none">Risque Critique</p>
                                <p className="text-[10px] text-muted-foreground mt-1">Élèves en danger immédiat (décrochage + échec).</p>
                             </div>
                          </div>
                          <div className="flex items-start gap-3">
                             <div className="w-3 h-3 rounded-full bg-orange-500 mt-0.5" />
                             <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold leading-none">Vigilance Accrue</p>
                                <p className="text-[10px] text-muted-foreground mt-1">Alerte sur l'un des deux axes majeurs.</p>
                             </div>
                          </div>
                          <div className="flex items-start gap-3">
                             <div className="w-3 h-3 rounded-full bg-emerald-500 mt-0.5" />
                             <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold leading-none">Zone de Stabilité</p>
                                <p className="text-[10px] text-muted-foreground mt-1">Élèves sans risque majeur identifié.</p>
                             </div>
                          </div>
                       </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                      * Les points sont interactifs. Cliquez pour voir le profil détaillé et engager une intervention.
                    </p>
                 </div>
               </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-none bg-muted/20">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground uppercase font-bold text-[10px]">
                    <tr>
                      <th className="px-4 py-3 text-left">Élève</th>
                      <th className="px-4 py-3 text-left">Classe</th>
                      <th className="px-4 py-3 text-center">Évolution</th>
                      <th className="px-4 py-3 text-center">Score</th>
                      <th className="px-4 py-3 text-center">Présence</th>
                      <th className="px-4 py-3 text-center">Moyenne</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Chargement des risques...</td>
                      </tr>
                    ) : riskRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10">
                          <div className="flex flex-col items-center text-center gap-2">
                            <AlertCircle className="w-8 h-8 text-muted-foreground/50" />
                            <p className="font-bold text-sm">Aucune donnée de risque</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      riskRows.map((row) => (
                        <tr key={row.studentId} className="hover:bg-background/50 transition-colors">
                          <td className="px-4 py-3 font-bold">{row.name}</td>
                          <td className="px-4 py-3">{row.className}</td>
                          <td className={cn(
                            "px-4 py-3 text-center font-mono",
                            row.trend === "up" ? "text-destructive" : row.trend === "down" ? "text-[hsl(var(--success))]" : "text-warning"
                          )}>
                            {row.trend === "up" ? "↗ Hausse" : row.trend === "down" ? "↘ Baisse" : "→ Stable"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                              row.status === "CRITICAL" ? "bg-destructive/10 text-destructive border-destructive/20" :
                              row.status === "HIGH" ? "bg-warning/10 text-warning border-warning/20" :
                              row.status === "MEDIUM" ? "bg-primary/10 text-primary border-primary/20" :
                              "bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] border-[hsl(var(--success-border))]"
                            )}>
                              {row.riskScore}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">{row.attendanceRate != null ? `${row.attendanceRate.toFixed(1)}%` : "-"}</td>
                          <td className="px-4 py-3 text-center">{row.averageGrade != null ? `${row.averageGrade.toFixed(2)}/20` : "-"}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Link href={`/dashboard/students/${row.studentId}`} onClick={() => markStudentTransition(row.studentId)}>
                                <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold uppercase">Profil</Button>
                              </Link>
                              <Link href={`/dashboard/messages?studentId=${row.studentId}`}>
                                <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold uppercase">Parents</Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Colonne Droite: Alertes Active (4/12) */}
        <div className="lg:col-span-4 space-y-6">
           <Card className="border-none shadow-none bg-muted/20">
              <CardHeader className="p-4 border-b border-border/50 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Alertes Prioritaires</CardTitle>
                <span className="h-5 px-1.5 rounded bg-destructive text-white text-[10px] font-bold flex items-center">{topAlerts.length}</span>
              </CardHeader>
              <CardContent className="p-0">
                 <div className="divide-y divide-border/50">
                  {topAlerts.length === 0 ? (
                    <div className="p-6">
                      <div className="flex flex-col items-center text-center gap-2">
                        <AlertCircle className="w-7 h-7 text-muted-foreground/50" />
                        <p className="font-bold text-sm">Aucune alerte prioritaire</p>
                      </div>
                    </div>
                  ) : (
                    topAlerts.map((alert) => (
                      <div key={alert.studentId} className="p-4 space-y-3 hover:bg-background/40 transition-colors">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">{alert.className}</span>
                          <span className="text-[10px] font-bold text-destructive">Score {alert.riskScore}</span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground leading-tight">{alert.name}</p>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                            Présence {alert.attendanceRate != null ? `${alert.attendanceRate.toFixed(1)}%` : "N/A"} · Moyenne {alert.averageGrade != null ? `${alert.averageGrade.toFixed(2)}/20` : "N/A"}
                          </p>
                        </div>
                        <Link href={`/dashboard/students/${alert.studentId}`} onClick={() => markStudentTransition(alert.studentId)}>
                          <Button variant="outline" size="sm" className="w-full h-7 text-[10px] font-bold uppercase tracking-tight group">
                            {t("appActions.viewRecord")}
                            <ArrowRight className="w-3 h-3 ml-2 group-hover:translate-x-1 transition-transform" />
                          </Button>
                        </Link>
                      </div>
                    ))
                  )}
                 </div>
              </CardContent>
           </Card>
           
           <Card className="border-none shadow-none bg-[hsl(var(--success-bg))] border border-[hsl(var(--success))]/10 p-4 space-y-4">
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-[hsl(var(--success))]">Action Rapide</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Besoin d&apos;une synthèse pour un conseil de classe ? L&apos;assistant IA peut générer un rapport complet des élèves à risque.
              </p>
              <Button className="w-full h-8 text-[11px] font-bold uppercase bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90">
                Générer Rapport IA
              </Button>
           </Card>
        </div>
      </div>
    </div>
  );
}
