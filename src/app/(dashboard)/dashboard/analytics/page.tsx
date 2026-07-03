"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading, PageError, PageEmpty } from "@/components/layout/page-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Permission } from "@/lib/rbac/permissions";
import {
    BarChart3, AlertCircle, Users, GraduationCap, TrendingUp,
    RefreshCcw, Wallet, FileText, CalendarDays, Scale, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSchool } from "@/components/providers/school-provider";

import { AnalyticsProvider, useAnalytics, StudentSegment } from "@/components/analytics/AnalyticsContext";
import { AnalyticsContextBar } from "@/components/analytics/AnalyticsContextBar";
import { PerformanceHeatmap } from "@/components/charts/PerformanceHeatmap";
import { AttendanceHeatmap } from "@/components/charts/AttendanceHeatmap";
import { InteractivePerformanceBarChart } from "@/components/charts/InteractivePerformanceBarChart";
import { InteractiveRiskPieChart } from "@/components/charts/InteractiveRiskPieChart";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { AttendanceGradesScatter } from "@/components/charts/AttendanceGradesScatter";
import { PerformanceBarChart } from "@/components/charts/PerformanceBarChart";
import { RiskInterventionTab } from "@/components/analytics/RiskInterventionTab";
import { FinanceAnalyticsTab } from "@/components/analytics/FinanceAnalyticsTab";
import { AcademicPerformancesTab } from "@/components/analytics/AcademicPerformancesTab";
import { AnalyticsComparisonsTab } from "@/components/analytics/AnalyticsComparisonsTab";
import { AnalyticsReportsTab } from "@/components/analytics/AnalyticsReportsTab";
import { AnalyticsEmptyState } from "@/components/analytics/AnalyticsEmptyState";
import { RiskStudentsDrillDown } from "@/components/analytics/RiskStudentsDrillDown";
import { AnalyticsBIBoard } from "@/components/analytics/AnalyticsBIBoard";

function AnalyticsContent() {
    const { schoolId: activeSchoolId } = useSchool();
    const { 
        academicYearId, periodId, levelIds, classIds, subjectIds, studentSegment 
    } = useAnalytics();
    
    const [isSyncing, setIsSyncing] = useState(false);

    const classesEndpoint = activeSchoolId
        ? `/api/classes?limit=100&schoolId=${encodeURIComponent(activeSchoolId)}`
        : "/api/classes?limit=100";
    const { data: classesData } = useSWR(classesEndpoint, fetcher);
    const classes = classesData?.data ?? classesData ?? [];

    const { data: academicYears } = useSWR("/api/academic-years", fetcher);
    const activeYear = useMemo(() => 
        Array.isArray(academicYears) ? academicYears.find((y: any) => y.id === academicYearId) : null
    , [academicYears, academicYearId]);
    const periods = activeYear?.periods || [];

    const analyticsQuery = useMemo(() => {
        const params = new URLSearchParams();
        if (academicYearId !== "ALL") params.set("academicYearId", academicYearId);
        if (periodId !== "ALL") params.set("periodId", periodId);
        if (levelIds.length > 0) params.set("levels", levelIds.join(","));
        if (classIds.length > 0) params.set("classes", classIds.join(","));
        if (subjectIds.length > 0) params.set("subjects", subjectIds.join(","));
        if (studentSegment !== StudentSegment.ALL) params.set("segment", studentSegment);
        if (activeSchoolId) params.set("schoolId", activeSchoolId);
        return params.toString();
    }, [academicYearId, periodId, levelIds, classIds, subjectIds, studentSegment, activeSchoolId]);

    const handleGlobalSync = async () => {
        setIsSyncing(true);
        try {
            const response = await fetch("/api/analytics/sync-all", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ academicYearId }),
            });
            const result = await response.json();
            if (result.success) {
                toast.success(`Synchronisation terminée : ${result.processed} nouveaux rapports générés.`);
                window.location.reload();
            } else {
                toast.error(result.error || "Erreur lors de la synchronisation");
            }
        } catch (error) {
            toast.error("Erreur réseau lors de la synchronisation");
        } finally {
            setIsSyncing(false);
        }
    };

    const {
        data: overview,
        isLoading: overviewLoading,
        error: overviewError,
    } = useSWR(`/api/analytics/school/overview${analyticsQuery ? `?${analyticsQuery}` : ""}`, fetcher);

    const { 
        data: financeStats 
    } = useSWR(activeSchoolId ? `/api/finance/stats?schoolId=${encodeURIComponent(activeSchoolId)}&period=academic` : null, fetcher);

    const attendanceRate = useMemo(() => {
        const stats = overview?.attendanceDistribution;
        if (!stats) return null;
        const total = Number(stats.present || 0) + Number(stats.absent || 0) + Number(stats.late || 0) + Number(stats.excused || 0);
        if (total <= 0) return null;
        return ((Number(stats.present || 0) + Number(stats.late || 0) + Number(stats.excused || 0)) / total) * 100;
    }, [overview]);

    const [riskFilter, setRiskFilter] = useState<string>("");

    // L'API renvoie riskDistribution sous forme d'objet { low, medium, high, critical } ;
    // le pie chart attend un tableau [{ name, value, color }].
    const riskChartData = useMemo(() => {
        const dist = overview?.riskDistribution;
        if (!dist) return [];
        return [
            { name: "LOW", value: Number(dist.low || 0), color: "#10b981" },
            { name: "MEDIUM", value: Number(dist.medium || 0), color: "#f59e0b" },
            { name: "HIGH", value: Number(dist.high || 0), color: "#ef4444" },
            { name: "CRITICAL", value: Number(dist.critical || 0), color: "#7f1d1d" },
        ];
    }, [overview]);

    const absenteeismPatterns = useMemo(() => {
        const stats = overview?.attendanceDistribution;
        if (!stats) {
            return {
                excellent: 0,
                veryGood: 0,
                good: 0,
                average: 0,
                insufficient: 0,
                weak: 0,
            };
        }
        // Map attendance buckets onto the chart's expected performance keys
        // so we keep the visual distribution (présents → vert, retards → moyen,
        // excusés → faible, absents → rouge).
        return {
            excellent: Number(stats.present || 0),
            veryGood: 0,
            good: Number(stats.late || 0),
            average: Number(stats.excused || 0),
            insufficient: Number(stats.absent || 0),
            weak: 0,
        };
    }, [overview]);

    return (
        <PageGuard permission={[ Permission.ANALYTICS_VIEW ]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}>
            <div className="space-y-6 dashboard-motion pb-12">
                <PageHeader
                    title="Analytics"
                    description="Indicateurs de performance et statistiques de l'établissement"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Analytics" },
                    ]}
                    actions={
                        <Button variant="secondary" onClick={handleGlobalSync} disabled={isSyncing} className="gap-2 action-critical">
                            <RefreshCcw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                            Synchroniser
                        </Button>
                    }
                />

                <AnalyticsContextBar />

                <Tabs defaultValue="bi" className="space-y-6">
                    <TabsList className="dashboard-panel bg-muted/50 p-1 flex-wrap h-auto">
                        <TabsTrigger value="bi" className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            BI
                        </TabsTrigger>
                        <TabsTrigger value="overview">Vue Globale</TabsTrigger>
                        <TabsTrigger value="performances" className="flex items-center gap-2">
                            <GraduationCap className="h-4 w-4" />
                            Performances
                        </TabsTrigger>
                        <TabsTrigger value="attendance" className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4" />
                            Assiduité
                        </TabsTrigger>
                        <TabsTrigger value="risks" className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            Risques
                        </TabsTrigger>
                        <TabsTrigger value="finance" className="flex items-center gap-2">
                            <Wallet className="h-4 w-4" />
                            Finances
                        </TabsTrigger>
                        <TabsTrigger value="comparisons" className="flex items-center gap-2">
                            <Scale className="h-4 w-4" />
                            Comparaisons
                        </TabsTrigger>
                        <TabsTrigger value="reports" className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Rapports
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="bi" className="space-y-6">
                        <AnalyticsBIBoard
                            schoolId={activeSchoolId ?? undefined}
                            academicYearId={academicYearId}
                        />
                    </TabsContent>

                    <TabsContent value="overview" className="space-y-6">
                        {overviewError && (
                            <Card className="border-destructive/30 bg-destructive/5">
                                <CardContent className="py-4 text-sm text-destructive">
                                    Impossible de charger les indicateurs analytiques pour le contexte sélectionné.
                                </CardContent>
                            </Card>
                        )}
                        {overview?.overview ? (
                        <>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            {[
                                { label: "Moyenne Générale", value: overview ? `${overview?.overview?.averageGrade || "0.00"}/20` : "—", color: "text-primary" },
                                { label: "Taux de présence", value: attendanceRate != null ? `${attendanceRate.toFixed(1)}%` : "N/D", color: "text-success" },
                                { label: "Taux de réussite", value: overview ? `${(100 - Number(overview?.overview?.failureRate || 0)).toFixed(1)}%` : "—", color: "text-primary" },
                                { label: "Élèves à risque", value: overview ? (overview?.overview?.atRiskCount || 0) : "—", color: "text-warning" },
                                { label: "Recouvrement", value: financeStats ? `${Number(financeStats?.collectionRate || 0).toFixed(1)}%` : "N/D", color: "text-primary" },
                                { label: "Engagement LMS", value: "N/D", color: "text-warning" },
                            ].map((kpi, i) => (
                                <Card key={i} className="dashboard-block kpi-card border-border bg-card">
                                    <CardHeader className="pb-2">
                                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{kpi.label}</div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className={cn("text-3xl metric-serif", kpi.color, overviewLoading && "opacity-60")}>{kpi.value}</div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
                            <Card className="lg:col-span-6 dashboard-block border-border bg-card">
                                <CardHeader><CardTitle className="text-sm font-medium">Performance par matière</CardTitle></CardHeader>
                                <CardContent>
                                    <InteractivePerformanceBarChart data={overview?.subjectSummary || []} />
                                </CardContent>
                            </Card>
                            <Card className="lg:col-span-4 dashboard-block border-border bg-card">
                                <CardHeader><CardTitle className="text-sm font-medium">Niveaux de risque</CardTitle></CardHeader>
                                <CardContent>
                                    <InteractiveRiskPieChart
                                        data={riskChartData}
                                        description="Cliquez sur un segment pour lister les élèves concernés"
                                        onRiskClick={(level) => setRiskFilter(level === riskFilter ? "" : level)}
                                        filterRiskLevel={riskFilter || undefined}
                                    />
                                </CardContent>
                            </Card>
                        </div>

                        {riskFilter ? (
                            <RiskStudentsDrillDown
                                riskLevel={riskFilter}
                                academicYearId={academicYearId || undefined}
                                periodId={periodId || undefined}
                            />
                        ) : null}

                        <Card className="dashboard-block border-border bg-card">
                            <CardHeader>
                                <CardTitle className="text-sm font-medium flex items-center justify-between">
                                    Carte thermique des performances
                                    <Badge variant="outline" className="text-[10px]">Par classe & matière</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <PerformanceHeatmap data={overview?.heatmap || { classes: [], subjects: [], matrix: {} }} />
                            </CardContent>
                        </Card>

                        <Card className="dashboard-block border-border bg-card">
                            <CardHeader><CardTitle className="text-sm font-medium">Évolution temporelle des moyennes</CardTitle></CardHeader>
                            <CardContent className="h-[300px]">
                                <TrendLineChart data={overview?.temporalTrend || []} />
                            </CardContent>
                        </Card>
                        </>
                        ) : (
                            !overviewLoading && !overviewError ? (
                                <AnalyticsEmptyState
                                    title="Aucune donnée analytique exploitable"
                                    description="Lancez une synchronisation, vérifiez vos filtres puis revenez sur cette vue pour visualiser les indicateurs."
                                    primaryLabel="Synchroniser maintenant"
                                    primaryHref="/dashboard/analytics"
                                    secondaryLabel="Configurer l'année"
                                    secondaryHref="/dashboard/settings/academic"
                                />
                            ) : null
                        )}
                    </TabsContent>

                    <TabsContent value="performances" className="space-y-6">
                        <AcademicPerformancesTab classes={classes} academicYearId={academicYearId} />
                    </TabsContent>

                    <TabsContent value="attendance" className="space-y-6">
                        <Card className="dashboard-block border-border bg-card">
                            <CardHeader><CardTitle className="text-sm font-medium">Calendrier thermique de présence annuel</CardTitle></CardHeader>
                            <CardContent>
                                <AttendanceHeatmap data={overview?.attendanceCalendar || {}} />
                            </CardContent>
                        </Card>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="dashboard-block border-border bg-card">
                                <CardHeader><CardTitle className="text-sm font-medium">Corrélation Assiduité / Performance</CardTitle></CardHeader>
                                <CardContent><AttendanceGradesScatter /></CardContent>
                            </Card>
                            <Card className="dashboard-block border-border bg-card">
                                <CardHeader><CardTitle className="text-sm font-medium">Patterns d&apos;absentéisme</CardTitle></CardHeader>
                                <CardContent><PerformanceBarChart data={absenteeismPatterns} /></CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="risks">
                        <RiskInterventionTab atRiskStudents={overview?.atRiskStudents || []} academicYearId={academicYearId} />
                    </TabsContent>

                    <TabsContent value="finance">
                        <FinanceAnalyticsTab data={financeStats} />
                    </TabsContent>

                    <TabsContent value="comparisons">
                        <AnalyticsComparisonsTab classes={classes} academicYearId={academicYearId} periods={periods} />
                    </TabsContent>

                    <TabsContent value="reports">
                        <AnalyticsReportsTab />
                    </TabsContent>
                </Tabs>
            </div>
        </PageGuard>
    );
}

export default function AnalyticsPage() {
    const { academicYearId, periodId } = useSchool();
    
    return (
        <AnalyticsProvider initialAcademicYearId={academicYearId || "ALL"} initialPeriodId={periodId || "ALL"}>
            <AnalyticsContent />
        </AnalyticsProvider>
    );
}
