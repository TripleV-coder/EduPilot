"use client";

import { useMemo, useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading, PageError } from "@/components/layout/page-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ShieldAlert, 
  ArrowRight, Filter, Download
} from "lucide-react";
import { RiskMatrix, type RiskMatrixPoint } from "@/components/charts/RiskMatrix";
import { cn } from "@/lib/utils";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useSchoolThresholds } from "@/hooks/use-school-thresholds";
import { assessRisk } from "@/lib/schools/school-parameters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { t } from "@/lib/i18n";
import { AnalyticsEmptyState } from "@/components/analytics/AnalyticsEmptyState";
import type { Class } from "@/lib/types";

type AnalyticsStudent = {
  studentId: string;
  studentName: string;
  /** Classe active de l'élève (renvoyée par l'API depuis le Lot 3). */
  className?: string | null;
  averageGrade: number | null;
  attendanceRate: number | null;
  riskLevel: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
  riskFactors?: string[];
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
  factors: string[];
  status: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  attendanceRate: number | null;
  averageGrade: number | null;
  incidentsCount: number;
};

const STATUS_LABEL: Record<RiskRow["status"], string> = { CRITICAL: "Critique", HIGH: "Élevé", MEDIUM: "Modéré", LOW: "Faible" };
const SEVERITY: Record<RiskRow["status"], number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

export default function AlertsRisksPage() {
  return (
    <PageGuard roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
      <AlertsRisksContent />
    </PageGuard>
  );
}

function AlertsRisksContent() {
  const thresholds = useSchoolThresholds();
  const [classId, setClassId] = useState<string>("all");

  const markStudentTransition = (studentId: string) => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem("edupilot-student-transition", studentId);
  };

  const { data: classesData } = useSWR<{ data: Class[] }>("/api/classes?limit=200", fetcher);
  const classes = classesData?.data || [];

  const analyticsUrl = classId === "all"
    ? "/api/analytics/students?latestOnly=true&limit=200"
    : `/api/analytics/students?latestOnly=true&limit=200&classId=${classId}`;
  const incidentsUrl = classId === "all"
    ? "/api/incidents?limit=200"
    : `/api/incidents?limit=200&classId=${classId}`;

  const {
    data: analyticsData,
    isLoading: analyticsLoading,
    error: analyticsError,
    mutate: reloadAnalytics,
  } = useSWR<AnalyticsStudent[]>(analyticsUrl, fetcher);
  // Format paginé du projet : { data, pagination }
  const { data: incidentsData, isLoading: incidentsLoading } = useSWR<{ data?: IncidentApiItem[] }>(incidentsUrl, fetcher);

  const riskRows = useMemo<RiskRow[]>(() => {
    const analytics = Array.isArray(analyticsData) ? analyticsData : [];
    const incidents = incidentsData?.data || [];

    const incidentsByStudent = incidents.reduce<Record<string, number>>((acc, item) => {
      acc[item.studentId] = (acc[item.studentId] || 0) + 1;
      return acc;
    }, {});

    return analytics
      .map((row) => {
        const incidentCount = incidentsByStudent[row.studentId] || 0;
        // Calcul officiel unique (mêmes points et seuils que les analyses enregistrées) ;
        // le niveau enregistré fait foi quand il existe.
        const official = assessRisk(row.averageGrade, row.attendanceRate, incidentCount, thresholds.followUp, thresholds.passingGrade);
        const level = row.riskLevel ?? official.level;
        const status: RiskRow["status"] = level === "NONE" ? "LOW" : level;
        const factors = row.riskFactors && row.riskFactors.length > 0 ? row.riskFactors : official.factors;

        const className = row.className || row.student?.enrollments?.[0]?.class?.name || "Non assignée";

        return {
          studentId: row.studentId,
          name: row.studentName,
          className,
          riskScore: official.score,
          factors,
          status,
          attendanceRate: row.attendanceRate,
          averageGrade: row.averageGrade,
          incidentsCount: incidentCount,
        };
      })
      .sort((a, b) => SEVERITY[b.status] - SEVERITY[a.status] || b.riskScore - a.riskScore);
  }, [analyticsData, incidentsData, thresholds]);

  const topAlerts = riskRows.filter((r) => r.status === "HIGH" || r.status === "CRITICAL").slice(0, 5);
  const isLoading = analyticsLoading || incidentsLoading;
  const matrixPoints = useMemo<RiskMatrixPoint[]>(
    () =>
      riskRows.map((row) => ({
        id: row.studentId,
        name: row.name,
        className: row.className,
        absenceRate: row.attendanceRate == null ? null : 100 - row.attendanceRate,
        average: row.averageGrade,
      })),
    [riskRows]
  );

  return (
    <PageShell className="animate-fade-in">
      <PageHeader
        title="Module de prévention"
        description="Anticipez le décrochage scolaire et les risques académiques par une analyse prédictive."
        breadcrumbs={[
          { label: "Tableau de bord", href: "/dashboard" },
          { label: "Alertes & Risques" },
        ]}
        actions={
          <div className="flex items-center gap-2">
           <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger aria-label="Filtrer par classe" className="w-[220px] h-9 text-[11px] font-bold">
              <SelectValue placeholder="Toutes les classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les classes</SelectItem>
              {classes.map((classItem: Class) => (
                <SelectItem key={classItem.id} value={classItem.id}>
                  {classItem.name}
                </SelectItem>
              ))}
            </SelectContent>
           </Select>
           <Button type="button" variant="outline" size="sm" className="h-9 text-[11px] font-bold" onClick={() => setClassId("all")}>
             <Filter className="w-3.5 h-3.5 mr-2" />
             {t("common.reset")} filtres
           </Button>
          <Button type="button" variant="outline" size="sm" className="h-9 text-[11px] font-bold">
             <Download className="w-3.5 h-3.5 mr-2" />
             {t("common.export")}
           </Button>
        </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Colonne Gauche: Matrice (8/12) */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-none shadow-none bg-muted/20">
            <CardHeader className="p-4 border-b border-border/50">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-destructive" />
                  Matrice des Risques (Décrochage vs Échec)
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
               <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                 <div className="md:col-span-7">
                    <RiskMatrix
                      students={matrixPoints}
                      absenceAlert={100 - thresholds.followUp.attendanceWarning}
                      passingGrade={thresholds.passingGrade}
                    />
                 </div>
                 <div className="md:col-span-5 space-y-4">
                    <div className="p-4 rounded-xl bg-background/50 border border-border/50">
                       <h3 className="text-xs font-bold tracking-tight mb-2">Légende matrice</h3>
                       <div className="space-y-3">
                          <div className="flex items-start gap-3">
                             <div className="w-3 h-3 rounded-full bg-destructive animate-pulse mt-0.5" />
                             <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold leading-none">Risque Critique</p>
                                <p className="text-[11px] text-muted-foreground mt-1">Absences au-delà du seuil d&apos;alerte et moyenne sous le seuil de passage.</p>
                             </div>
                          </div>
                          <div className="flex items-start gap-3">
                             <div className="w-3 h-3 rounded-full bg-warning mt-0.5" />
                             <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold leading-none">Vigilance Accrue</p>
                                <p className="text-[11px] text-muted-foreground mt-1">Un seul des deux seuils est franchi.</p>
                             </div>
                          </div>
                          <div className="flex items-start gap-3">
                             <div className="w-3 h-3 rounded-full bg-success mt-0.5" />
                             <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold leading-none">Zone de Stabilité</p>
                                <p className="text-[11px] text-muted-foreground mt-1">Élèves sans risque majeur identifié.</p>
                             </div>
                          </div>
                       </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                      * Survolez un point pour voir l&apos;élève, ses absences et sa moyenne. Les élèves sans moyenne ou sans appel ne sont pas placés.
                    </p>
                 </div>
               </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-none bg-muted/20">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground font-bold text-[11px]">
                    <tr>
                      <th className="px-4 py-3 text-left">Élève</th>
                      <th className="px-4 py-3 text-left">Classe</th>
                      <th className="px-4 py-3 text-left">Facteurs</th>
                      <th className="px-4 py-3 text-center">Niveau (points)</th>
                      <th className="px-4 py-3 text-center">Présence</th>
                      <th className="px-4 py-3 text-center">Moyenne</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10">
                          <PageLoading label="Chargement des risques…" />
                        </td>
                      </tr>
                    ) : analyticsError ? (
                      // Une panne de chargement affichait « aucun élève à
                      // risque » : le plus rassurant des messages, et le plus
                      // faux.
                      <tr>
                        <td colSpan={7} className="px-4 py-10">
                          <PageError
                            message="Impossible de charger les indicateurs de risque."
                            onRetry={() => void reloadAnalytics()}
                          />
                        </td>
                      </tr>
                    ) : riskRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10">
                          <AnalyticsEmptyState
                            title="Aucune donnée de risque pour ce filtre"
                            description="Ajustez la classe sélectionnée ou synchronisez les données analytiques pour afficher la matrice."
                            primaryLabel="Voir Analytics"
                            primaryHref="/dashboard/analytics"
                            secondaryLabel="Réinitialiser"
                            secondaryHref="/dashboard/alerts/risks"
                          />
                        </td>
                      </tr>
                    ) : (
                      riskRows.map((row) => (
                        <tr key={row.studentId} className="hover:bg-background/50 transition-colors">
                          <td className="px-4 py-3 font-bold">{row.name}</td>
                          <td className="px-4 py-3">{row.className}</td>
                          <td className="px-4 py-3 text-[11px] text-muted-foreground">
                            {row.factors.length > 0 ? row.factors.slice(0, 2).join(" · ") : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[11px] font-bold border",
                              row.status === "CRITICAL" ? "bg-destructive/10 text-destructive border-destructive/20" :
                              row.status === "HIGH" ? "bg-warning/10 text-warning border-warning/20" :
                              row.status === "MEDIUM" ? "bg-primary/10 text-primary border-primary/20" :
                              "bg-success/10 text-success border-success/30"
                            )}>
                              {STATUS_LABEL[row.status]} ({row.riskScore})
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">{row.attendanceRate != null ? `${row.attendanceRate.toFixed(1)}%` : "-"}</td>
                          <td className="px-4 py-3 text-center">{row.averageGrade != null ? `${row.averageGrade.toFixed(2)}/20` : "-"}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Link href={`/dashboard/students/${row.studentId}`} onClick={() => markStudentTransition(row.studentId)}>
                                <Button variant="outline" size="sm" className="h-7 text-[11px] font-bold">Profil</Button>
                              </Link>
                              <Link href={`/dashboard/messages?studentId=${row.studentId}`}>
                                <Button variant="outline" size="sm" className="h-7 text-[11px] font-bold">Parents</Button>
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
                <CardTitle className="text-xs font-bold text-muted-foreground">Alertes prioritaires</CardTitle>
                <span className="h-5 px-1.5 rounded bg-destructive text-white text-[11px] font-bold flex items-center">{topAlerts.length}</span>
              </CardHeader>
              <CardContent className="p-0">
                 <div className="divide-y divide-border/50">
                  {topAlerts.length === 0 ? (
                    <div className="p-6">
                      <p className="text-sm font-medium text-muted-foreground text-center">Aucune alerte prioritaire sur ce périmètre.</p>
                    </div>
                  ) : (
                    topAlerts.map((alert) => (
                      <div key={alert.studentId} className="p-4 space-y-3 hover:bg-background/40 transition-colors">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[11px] font-bold text-muted-foreground">{alert.className}</span>
                          <span className="text-[11px] font-bold text-destructive">{STATUS_LABEL[alert.status]} · {alert.riskScore} pts</span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground leading-tight">{alert.name}</p>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                            Présence {alert.attendanceRate != null ? `${alert.attendanceRate.toFixed(1)}%` : "N/A"} · Moyenne {alert.averageGrade != null ? `${alert.averageGrade.toFixed(2)}/20` : "N/A"}
                          </p>
                        </div>
                        <Link href={`/dashboard/students/${alert.studentId}`} onClick={() => markStudentTransition(alert.studentId)}>
                          <Button variant="outline" size="sm" className="w-full h-7 text-[11px] font-bold tracking-tight group">
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
           
           <Card className="border-none shadow-none bg-success/10 border border-success/20 p-4 space-y-4">
              <h3 className="text-[11px] font-bold text-success">Action rapide</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Besoin d&apos;une synthèse pour un conseil de classe ? L&apos;assistant IA peut générer un rapport complet des élèves à risque.
              </p>
              <Button asChild className="w-full h-8 text-[11px] font-bold bg-success hover:bg-success/90">
                <Link href="/dashboard/ai">Générer Rapport IA</Link>
              </Button>
           </Card>
        </div>
      </div>
    </PageShell>
  );
}
