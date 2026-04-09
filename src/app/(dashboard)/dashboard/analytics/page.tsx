"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useSession } from "next-auth/react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Permission } from "@/lib/rbac/permissions";
import { 
    BarChart3, AlertCircle, Users, GraduationCap, TrendingUp, 
    RefreshCcw, Wallet, FileText, CalendarDays, Scale 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
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

function AnalyticsContent() {
    const { data: session } = useSession();
    const { 
        academicYearId, periodId, levelIds, classIds, subjectIds, studentSegment 
    } = useAnalytics();
    
    const [isSyncing, setIsSyncing] = useState(false);

    const { data: classesData } = useSWR("/api/classes?limit=100", fetcher);
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
        return params.toString();
    }, [academicYearId, periodId, levelIds, classIds, subjectIds, studentSegment]);

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
    } = useSWR(session?.user?.schoolId ? `/api/finance/stats?schoolId=${session.user.schoolId}&period=academic` : null, fetcher);

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

                <Tabs defaultValue="overview" className="space-y-6">
                    <TabsList className="dashboard-panel bg-muted/50 p-1 flex-wrap h-auto">
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

                    <TabsContent value="overview" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            {[
                                { label: "Moyenne Générale", value: `${overview?.overview?.averageGrade || "0.00"}/20`, color: "text-primary" },
                                { label: "Taux de présence", value: `${overview?.overview?.attendanceRate || 0}%`, color: "text-emerald-600" },
                                { label: "Taux de réussite", value: `${overview?.overview?.successRate || 0}%`, color: "text-blue-600" },
                                { label: "Élèves à risque", value: overview?.overview?.atRiskCount || 0, color: "text-orange-500" },
                                { label: "Recouvrement", value: `${overview?.overview?.collectionRate || 0}%`, color: "text-purple-600" },
                                { label: "Engagement LMS", value: `${overview?.overview?.lmsEngagement || 0}%`, color: "text-amber-600" },
                            ].map((kpi, i) => (
                                <Card key={i} className="dashboard-block kpi-card border-border bg-card">
                                    <CardHeader className="pb-2">
                                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{kpi.label}</div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className={cn("text-3xl metric-serif", kpi.color)}>{kpi.value}</div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
                            <Card className="lg:col-span-6 dashboard-block border-border bg-card">
                                <CardHeader><CardTitle className="text-sm font-medium">Distribution des performances</CardTitle></CardHeader>
                                <CardContent>
                                    <InteractivePerformanceBarChart data={overview?.performanceDistribution || []} />
                                </CardContent>
                            </Card>
                            <Card className="lg:col-span-4 dashboard-block border-border bg-card">
                                <CardHeader><CardTitle className="text-sm font-medium">Niveaux de risque</CardTitle></CardHeader>
                                <CardContent>
                                    <InteractiveRiskPieChart data={overview?.riskDistribution || {}} />
                                </CardContent>
                            </Card>
                        </div>

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
                    </TabsContent>

                    <TabsContent value="performances" className="space-y-6">
                        <AcademicPerformancesTab classes={classes} academicYearId={academicYearId} />
                    </TabsContent>

                    <TabsContent value="attendance" className="space-y-6">
                        <Card className="dashboard-block border-border bg-card">
                            <CardHeader><CardTitle className="text-sm font-medium">Calendrier thermique de présence annuel</CardTitle></CardHeader>
                            <CardContent>
                                <AttendanceHeatmap data={{}} />
                            </CardContent>
                        </Card>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="dashboard-block border-border bg-card">
                                <CardHeader><CardTitle className="text-sm font-medium">Corrélation Assiduité / Performance</CardTitle></CardHeader>
                                <CardContent><AttendanceGradesScatter /></CardContent>
                            </Card>
                            <Card className="dashboard-block border-border bg-card">
                                <CardHeader><CardTitle className="text-sm font-medium">Patterns d&apos;absentéisme</CardTitle></CardHeader>
                                <CardContent><PerformanceBarChart data={overview?.absenteeismPatterns || []} /></CardContent>
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
