"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Permission } from "@/lib/rbac/permissions";
import { PerformanceBarChart } from "@/components/charts/PerformanceBarChart";
import { InteractivePerformanceBarChart } from "@/components/charts/InteractivePerformanceBarChart";
import { RiskPieChart } from "@/components/charts/RiskPieChart";
import { InteractiveRiskPieChart } from "@/components/charts/InteractiveRiskPieChart";
import { SubjectRadarChart } from "@/components/charts/SubjectRadarChart";
import { InteractiveSubjectRadarChart } from "@/components/charts/InteractiveSubjectRadarChart";
import { AttendancePieChart } from "@/components/charts/AttendancePieChart";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { ClassRankingBarChart } from "@/components/charts/ClassRankingBarChart";
import { AttendanceGradesScatter } from "@/components/charts/AttendanceGradesScatter";
import { MultiClassComparison } from "@/components/analytics/MultiClassComparison";
import { PeriodComparison } from "@/components/analytics/PeriodComparison";
import { exportToCSV, exportToPDF } from "@/lib/utils/export";
import {
    BarChart3,
    AlertCircle,
    Users,
    GraduationCap,
    TrendingUp,
    Filter,
    Download,
    RefreshCcw,
    ShieldAlert,
    Bookmark,
    GitCompare,
    Wallet,
    FileText,
    CalendarDays,
    Scale,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RiskInterventionTab } from "@/components/analytics/RiskInterventionTab";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

const selectClass =
    "touch-target h-11 w-full rounded-lg border border-input bg-background/92 px-3 py-2 text-sm shadow-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:outline-none";

function Spinner() {
    return (
        <div className="space-y-3 py-2">
            {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-14 rounded-lg bg-muted/40 skeleton-shimmer" />
            ))}
        </div>
    );
}

function ErrorAlert({ message }: { message: string }) {
    return (
        <div
            role="alert"
            className="rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] px-4 py-3 text-sm text-destructive flex items-center gap-2"
        >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>{message}</p>
        </div>
    );
}

export default function AnalyticsPage() {
    const { data: session } = useSession();
    const [selectedLevel, setSelectedLevel] = useState<string>("ALL");
    const [selectedCohort, setSelectedCohort] = useState<string>("ALL");
    const [savedViews, setSavedViews] = useState<Array<{ id: string; name: string; payload: any }>>([]);
    const [selectedSavedViewId, setSelectedSavedViewId] = useState<string>("NONE");
    const [compareEnabled, setCompareEnabled] = useState(false);
    const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>("ALL");
    const [selectedPeriodId, setSelectedPeriodId] = useState<string>("ALL");
    const [selectedClassId, setSelectedClassId] = useState<string>("");
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
    const [filterSubjectId, setFilterSubjectId] = useState<string>("");
    const [filterRiskLevel, setFilterRiskLevel] = useState<string>("");
    const [attendanceData, setAttendanceData] = useState<any[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [reportTitle, setReportTitle] = useState("Rapport analytique EduPilot");
    const [reportBlocks, setReportBlocks] = useState<Record<string, boolean>>({
        overview: true,
        risks: true,
        attendance: true,
        finance: false,
    });

    const { data: yearsData } = useSWR("/api/academic-years", fetcher);
    const { data: classesData } = useSWR("/api/classes?limit=100", fetcher);
    const classes = classesData?.data ?? classesData ?? [];
    const academicYears = Array.isArray(yearsData) ? yearsData : yearsData?.data || [];
    const activeYear = academicYears.find((y: any) => y.id === selectedAcademicYearId);
    const periods = activeYear?.periods || [];
    const availableLevels = useMemo(() => {
        const vals = new Set<string>();
        for (const c of Array.isArray(classes) ? classes : []) {
            const level = (c?.level || c?.classLevel?.name || "").trim();
            if (level) vals.add(level);
        }
        return Array.from(vals);
    }, [classes]);
    const filteredClasses = useMemo(() => {
        if (selectedLevel === "ALL") return classes;
        return (Array.isArray(classes) ? classes : []).filter((c: any) => {
            const level = (c?.level || c?.classLevel?.name || "").trim();
            return level === selectedLevel;
        });
    }, [classes, selectedLevel]);

    useEffect(() => {
        if (selectedAcademicYearId !== "ALL") return;
        const current = academicYears.find((y: any) => y.isCurrent);
        if (current?.id) setSelectedAcademicYearId(current.id);
    }, [academicYears, selectedAcademicYearId]);

    useEffect(() => {
        const raw = localStorage.getItem("edupilot_analytics_saved_views");
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setSavedViews(parsed);
        } catch {
            // ignore invalid storage
        }
    }, []);

    useEffect(() => {
        if (!selectedClassId) return;
        const stillExists = filteredClasses.some((c: any) => c.id === selectedClassId);
        if (!stillExists) {
            setSelectedClassId("");
            setSelectedSubjectId("");
        }
    }, [filteredClasses, selectedClassId]);

    const analyticsQuery = useMemo(() => {
        const params = new URLSearchParams();
        if (selectedAcademicYearId !== "ALL") params.set("academicYearId", selectedAcademicYearId);
        if (selectedPeriodId !== "ALL") params.set("periodId", selectedPeriodId);
        return params.toString();
    }, [selectedAcademicYearId, selectedPeriodId]);

    const handleGlobalSync = async () => {
        setIsSyncing(true);
        try {
            const response = await fetch("/api/analytics/sync-all", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ academicYearId: overview?.academicYearId }),
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

    // School overview
    const {
        data: overview,
        isLoading: overviewLoading,
        error: overviewError,
    } = useSWR(`/api/analytics/school/overview${analyticsQuery ? `?${analyticsQuery}` : ""}`, fetcher);

    const comparePeriodId = useMemo(() => {
        if (!compareEnabled || selectedPeriodId === "ALL") return null;
        const sorted = [...periods].sort((a: any, b: any) => (a.sequence ?? 0) - (b.sequence ?? 0));
        const idx = sorted.findIndex((p: any) => p.id === selectedPeriodId);
        if (idx <= 0) return null;
        return sorted[idx - 1]?.id || null;
    }, [compareEnabled, periods, selectedPeriodId]);

    const compareQuery = useMemo(() => {
        if (!comparePeriodId) return "";
        const p = new URLSearchParams();
        if (selectedAcademicYearId !== "ALL") p.set("academicYearId", selectedAcademicYearId);
        p.set("periodId", comparePeriodId);
        return p.toString();
    }, [comparePeriodId, selectedAcademicYearId]);

    const { data: compareOverview } = useSWR(
        compareQuery ? `/api/analytics/school/overview?${compareQuery}` : null,
        fetcher
    );
    const financeStatsUrl =
        session?.user?.schoolId
            ? `/api/finance/stats?schoolId=${session.user.schoolId}&period=academic`
            : null;
    const { data: financeStats } = useSWR(financeStatsUrl, fetcher);
    const attendanceStatsUrl = selectedClassId
        ? `/api/attendance/stats?classId=${selectedClassId}`
        : null;
    const { data: attendanceStats } = useSWR(attendanceStatsUrl, fetcher);

    // Student analytics (at-risk students)
    const {
        data: studentAnalytics,
        isLoading: studentAnalyticsLoading,
        error: studentAnalyticsError,
    } = useSWR(`/api/analytics/students?riskLevel=HIGH${analyticsQuery ? `&${analyticsQuery}` : ""}`, fetcher);

    // Class analytics
    const {
        data: classData,
        isLoading: classLoading,
        error: classError,
    } = useSWR(
        selectedClassId ? `/api/analytics/class/${selectedClassId}` : null,
        fetcher
    );

    // Subject analytics
    const {
        data: subjectData,
        isLoading: subjectLoading,
        error: subjectError,
    } = useSWR(
        selectedClassId && selectedSubjectId
            ? `/api/analytics/class/${selectedClassId}/subject/${selectedSubjectId}`
            : null,
        fetcher
    );

    const handleReset = () => {
        setSelectedLevel("ALL");
        setSelectedCohort("ALL");
        setCompareEnabled(false);
        setSelectedAcademicYearId("ALL");
        setSelectedPeriodId("ALL");
        setSelectedClassId("");
        setSelectedSubjectId("");
        setFilterSubjectId("");
        setFilterRiskLevel("");
        setSelectedSavedViewId("NONE");
    };

    const handleExportAnalytics = (format: "csv" | "pdf") => {
        if (!overview) return;

        const data = {
            title: "Analytics Export",
            headers: ["Métrique", "Valeur"],
            rows: [
                ["Distribution des performances", overview.performanceDistribution?.length || 0],
                ["Distribution des risques", overview.riskDistribution?.length || 0],
                ["Vue globale", "Exportée"],
            ] as (string | number)[][],
        };

        if (format === "csv") {
            exportToCSV(data);
        } else {
            exportToPDF(data);
        }
    };

    const handleClassChange = (value: string) => {
        setSelectedClassId(value);
        setSelectedSubjectId("");
    };

    const saveCurrentView = () => {
        const name = window.prompt("Nom de la vue analytique:");
        if (!name?.trim()) return;
        const payload = {
            selectedLevel,
            selectedCohort,
            selectedAcademicYearId,
            selectedPeriodId,
            selectedClassId,
            selectedSubjectId,
            filterSubjectId,
            filterRiskLevel,
            compareEnabled,
        };
        const next = [
            ...savedViews.filter((v) => v.name !== name.trim()),
            { id: `view_${Date.now()}`, name: name.trim(), payload },
        ];
        setSavedViews(next);
        setSelectedSavedViewId(next[next.length - 1].id);
        localStorage.setItem("edupilot_analytics_saved_views", JSON.stringify(next));
        toast.success("Vue analytique sauvegardée.");
    };

    const loadSavedView = (viewId: string) => {
        setSelectedSavedViewId(viewId);
        if (viewId === "NONE") return;
        const view = savedViews.find((v) => v.id === viewId);
        if (!view) return;
        const p = view.payload || {};
        setSelectedLevel(p.selectedLevel ?? "ALL");
        setSelectedCohort(p.selectedCohort ?? "ALL");
        setSelectedAcademicYearId(p.selectedAcademicYearId ?? "ALL");
        setSelectedPeriodId(p.selectedPeriodId ?? "ALL");
        setSelectedClassId(p.selectedClassId ?? "");
        setSelectedSubjectId(p.selectedSubjectId ?? "");
        setFilterSubjectId(p.filterSubjectId ?? "");
        setFilterRiskLevel(p.filterRiskLevel ?? "");
        setCompareEnabled(Boolean(p.compareEnabled));
    };

    const riskStudents = useMemo(() => {
        const base = overview?.atRiskStudents || [];
        if (selectedCohort === "ALL") return base;
        return base.filter((s: any) => {
            const risk = String(s?.riskLevel || s?.riskCategory || "").toUpperCase();
            if (selectedCohort === "HIGH_RISK") return risk.includes("HIGH");
            if (selectedCohort === "CRITICAL_RISK") return risk.includes("CRITICAL");
            return true;
        });
    }, [overview?.atRiskStudents, selectedCohort]);
    const attendanceSummary = useMemo(() => {
        const stats = attendanceStats || {};
        return {
            presentRate: Number(stats.presentRate || 0),
            absentRate: Number(stats.absentRate || 0),
            total: Number(stats.total || 0),
            absent: Number(stats.absent || 0),
            late: Number(stats.late || 0),
            excused: Number(stats.excused || 0),
        };
    }, [attendanceStats]);
    const financeSummary = useMemo(() => {
        const stats = financeStats || {};
        return {
            totalRevenue: Number(stats.totalRevenue || 0),
            totalPending: Number(stats.totalPending || 0),
            collectionRate: Number(stats.collectionRate || 0),
            revenueGrowth: Number(stats.revenueGrowth || 0),
            pendingGrowth: Number(stats.pendingGrowth || 0),
            revenueByMonth: Array.isArray(stats.revenueByMonth) ? stats.revenueByMonth : [],
            revenueByCycle: Array.isArray(stats.revenueByCycle) ? stats.revenueByCycle : [],
        };
    }, [financeStats]);
    const activeFiltersCount = [
        selectedAcademicYearId !== "ALL",
        selectedPeriodId !== "ALL",
        selectedLevel !== "ALL",
        !!selectedClassId,
        !!selectedSubjectId,
        selectedCohort !== "ALL",
        selectedSavedViewId !== "NONE",
        compareEnabled,
    ].filter(Boolean).length;
    const toggleReportBlock = (key: string) => {
        setReportBlocks((prev) => ({ ...prev, [key]: !prev[key] }));
    };
    const exportCustomReport = (format: "csv" | "pdf") => {
        const rows: Array<(string | number)>[] = [];
        if (reportBlocks.overview) {
            rows.push(["Moyenne générale", overview?.overview?.averageGrade ?? "0.00"]);
            rows.push(["Taux d'échec", `${overview?.overview?.failureRate ?? 0}%`]);
        }
        if (reportBlocks.risks) {
            rows.push(["Elèves à risque", overview?.overview?.atRiskCount ?? 0]);
            rows.push(["Décrochage critique", overview?.overview?.dropoutRiskCount ?? 0]);
        }
        if (reportBlocks.attendance) {
            rows.push(["Présence", `${attendanceSummary.presentRate.toFixed(2)}%`]);
            rows.push(["Absences", attendanceSummary.absent]);
        }
        if (reportBlocks.finance) {
            rows.push(["Recouvrement", `${financeSummary.collectionRate.toFixed(2)}%`]);
            rows.push(["Revenus", financeSummary.totalRevenue]);
            rows.push(["Impayés", financeSummary.totalPending]);
        }
        const exportPayload = {
            title: reportTitle,
            headers: ["Indicateur", "Valeur"],
            rows,
        };
        if (format === "csv") exportToCSV(exportPayload);
        else exportToPDF(exportPayload);
        toast.success("Rapport exporté.");
    };

    return (
        <PageGuard permission={[ Permission.ANALYTICS_VIEW, Permission.ANALYTICS_VIEW_OWN, Permission.ANALYTICS_VIEW_CHILDREN, ]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}>
            <div className="space-y-6 dashboard-motion">
                <PageHeader
                    title="Analytics"
                    description="Indicateurs de performance et statistiques de l'établissement"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Analytics" },
                    ]}
                />

                {/* Filter Bar */}
                <Card className="dashboard-block border-border bg-card" data-reveal>
                    <CardContent className="pt-6">
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Filter className="h-4 w-4" />
                                <span className="text-sm font-medium">Filtres</span>
                            </div>

                            <select
                                className={selectClass}
                                style={{ maxWidth: 220 }}
                                value={selectedAcademicYearId}
                                onChange={(e) => {
                                    setSelectedAcademicYearId(e.target.value);
                                    setSelectedPeriodId("ALL");
                                }}
                            >
                                <option value="ALL">Toutes les années</option>
                                {academicYears.map((y: any) => (
                                    <option key={y.id} value={y.id}>
                                        {y.name}
                                    </option>
                                ))}
                            </select>

                            <select
                                className={selectClass}
                                style={{ maxWidth: 220 }}
                                value={selectedPeriodId}
                                onChange={(e) => setSelectedPeriodId(e.target.value)}
                                disabled={selectedAcademicYearId === "ALL" || periods.length === 0}
                            >
                                <option value="ALL">Toute la période</option>
                                {periods.map((p: any) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>

                            <select
                                className={selectClass}
                                style={{ maxWidth: 200 }}
                                value={selectedLevel}
                                onChange={(e) => setSelectedLevel(e.target.value)}
                            >
                                <option value="ALL">Tous les niveaux</option>
                                {availableLevels.map((level) => (
                                    <option key={level} value={level}>
                                        {level}
                                    </option>
                                ))}
                            </select>

                            <select
                                className={selectClass}
                                style={{ maxWidth: 260 }}
                                value={selectedClassId}
                                onChange={(e) => handleClassChange(e.target.value)}
                            >
                                <option value="">Toutes les classes</option>
                                {Array.isArray(filteredClasses) &&
                                    filteredClasses.map(
                                        (c: { id: string; name: string; level?: string }) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                                {c.level ? ` (${c.level})` : ""}
                                            </option>
                                        )
                                    )}
                            </select>

                            {selectedClassId && classData?.subjectSummary && (
                                <select
                                    className={selectClass}
                                    style={{ maxWidth: 260 }}
                                    value={selectedSubjectId}
                                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                                >
                                    <option value="">Toutes les matières</option>
                                    {classData.subjectSummary.map(
                                        (s: { subjectId: string; name: string }) => (
                                            <option key={s.subjectId} value={s.subjectId}>
                                                {s.name}
                                            </option>
                                        )
                                    )}
                                </select>
                            )}

                            <select
                                className={selectClass}
                                style={{ maxWidth: 200 }}
                                value={selectedCohort}
                                onChange={(e) => setSelectedCohort(e.target.value)}
                            >
                                <option value="ALL">Cohorte: tous</option>
                                <option value="HIGH_RISK">Cohorte : risque élevé</option>
                                <option value="CRITICAL_RISK">Cohorte : risque critique</option>
                            </select>

                            <select
                                className={selectClass}
                                style={{ maxWidth: 220 }}
                                value={selectedSavedViewId}
                                onChange={(e) => loadSavedView(e.target.value)}
                            >
                                <option value="NONE">Vues sauvegardées</option>
                                {savedViews.map((v) => (
                                    <option key={v.id} value={v.id}>
                                        {v.name}
                                    </option>
                                ))}
                            </select>

                            {(selectedClassId || selectedSubjectId) && (
                                <Button
                                    variant="outline"
                                    onClick={handleReset}
                                    className="gap-1.5 touch-target"
                                >
                                    Réinitialiser
                                </Button>
                            )}

                            <div className="ml-auto flex gap-2">
                                {activeFiltersCount > 0 && (
                                    <span className="self-center text-[11px] text-muted-foreground whitespace-nowrap">
                                        {activeFiltersCount} filtre{activeFiltersCount > 1 ? "s" : ""}
                                    </span>
                                )}
                                <Button
                                    variant={compareEnabled ? "secondary" : "outline"}
                                    onClick={() => setCompareEnabled((v) => !v)}
                                    className="gap-1.5 touch-target"
                                >
                                    <GitCompare className="h-4 w-4" />
                                    Comparer
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={saveCurrentView}
                                    className="gap-1.5 touch-target"
                                >
                                    <Bookmark className="h-4 w-4" />
                                    Sauvegarder
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => handleExportAnalytics("csv")}
                                    className="gap-1.5 touch-target"
                                >
                                    <Download className="h-4 w-4" />
                                    CSV
                                </Button>
                                 <Button
                                    variant="outline"
                                    onClick={() => handleExportAnalytics("pdf")}
                                    className="gap-1.5 touch-target"
                                >
                                    <Download className="h-4 w-4" />
                                    PDF
                                </Button>

                                <Button
                                    variant="secondary"
                                    onClick={handleGlobalSync}
                                    disabled={isSyncing}
                                    className="gap-1.5 border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 touch-target action-critical"
                                    title="Forcer la mise à jour des données analytiques"
                                >
                                    <RefreshCcw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                                    {isSyncing ? t("analytics.actions.syncing") : t("analytics.actions.syncAll")}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {compareEnabled && compareOverview?.overview && comparePeriodId && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}>
                    <Card className="dashboard-block border-border bg-card/90" data-reveal>
                        <CardContent className="py-4">
                            <div className="flex flex-wrap items-center gap-4 text-sm">
                                <span className="font-semibold text-foreground">Comparaison période précédente</span>
                                <span className="text-muted-foreground">
                                    Moyenne: <span className="font-semibold text-foreground">{overview?.overview?.averageGrade ?? "0.00"}</span> vs {compareOverview?.overview?.averageGrade ?? "0.00"}
                                </span>
                                <span className="text-muted-foreground">
                                    Échec: <span className="font-semibold text-[hsl(var(--warning))]">{overview?.overview?.failureRate ?? 0}%</span> vs {compareOverview?.overview?.failureRate ?? 0}%
                                </span>
                                <span className="text-muted-foreground">
                                    À risque: <span className="font-semibold text-destructive">{overview?.overview?.atRiskCount ?? 0}</span> vs {compareOverview?.overview?.atRiskCount ?? 0}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                    </motion.div>
                )}

                <Tabs defaultValue="overview" className="space-y-6">
                    <TabsList className="dashboard-panel bg-muted/50 p-1">
                        <TabsTrigger value="overview">Vue Globale</TabsTrigger>
                        <TabsTrigger value="attendance" className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4" />
                            Assiduité
                        </TabsTrigger>
                        <TabsTrigger value="risks" className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            Risques & Interventions
                        </TabsTrigger>
                        <TabsTrigger value="finance" className="flex items-center gap-2">
                            <Wallet className="h-4 w-4" />
                            Finances
                        </TabsTrigger>
                        <TabsTrigger value="comparisons" className="flex items-center gap-2">
                            <Scale className="h-4 w-4" />
                            Comparaisons
                        </TabsTrigger>
                        <TabsTrigger value="classes">Classes</TabsTrigger>
                        <TabsTrigger value="subjects">Matières</TabsTrigger>
                        <TabsTrigger value="reports" className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Rapports
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview">
                        {/* Section: Overview KPIs */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
                            <Card className="dashboard-block kpi-card border-border bg-card" data-reveal>
                                <CardHeader className="pb-2">
                                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Moyenne Générale</div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl metric-serif">{overview?.overview?.averageGrade || "0.00"}/20</div>
                                </CardContent>
                            </Card>
                            <Card className="dashboard-block kpi-card border-border bg-card" data-reveal>
                                <CardHeader className="pb-2">
                                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Taux d'échec (Prév.)</div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl metric-serif text-[hsl(var(--warning))]">{overview?.overview?.failureRate || 0}%</div>
                                </CardContent>
                            </Card>
                            <Card className="dashboard-block kpi-card border-border bg-card" data-reveal>
                                <CardHeader className="pb-2">
                                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Décrochage (Critique)</div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl metric-serif text-destructive">{overview?.overview?.dropoutRiskCount || 0}</div>
                                </CardContent>
                            </Card>
                            <Card className="dashboard-block kpi-card border-border bg-card" data-reveal>
                                <CardHeader className="pb-2">
                                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">À risque (Élevé)</div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl metric-serif text-[hsl(var(--warning))]">{overview?.overview?.atRiskCount || 0}</div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Section 1: Vue Globale */}
                        <section className="space-y-4 pt-6">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <BarChart3 className="h-5 w-5 text-primary" />
                                Vue Globale
                            </h2>

                            {overviewLoading && <Spinner />}
                            {overviewError && (
                                <ErrorAlert message="Erreur lors du chargement de la vue globale." />
                            )}

                            {!overviewLoading && !overviewError && !overview && (
                                <div className="text-center py-16 border border-dashed border-border rounded-xl bg-muted/30">
                                    <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                                    <h3 className="text-lg font-medium text-foreground">
                                        Aucune donnée analytique
                                    </h3>
                                    <p className="text-sm text-muted-foreground mt-2">
                                        Les données apparaîtront une fois que l&apos;établissement
                                        aura commencé à fonctionner.
                                    </p>
                                </div>
                            )}

                            {overview && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Card className="dashboard-block border-border bg-card" data-reveal>
                                        <CardHeader>
                                            <CardTitle className="text-sm font-medium">
                                                Distribution des performances
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <InteractivePerformanceBarChart
                                                data={overview.performanceDistribution}
                                            />
                                        </CardContent>
                                    </Card>

                                    <Card className="dashboard-block border-border bg-card" data-reveal>
                                        <CardHeader>
                                            <CardTitle className="text-sm font-medium">
                                                Niveaux de risque
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <InteractiveRiskPieChart
                                                data={overview.riskDistribution}
                                                onRiskClick={(riskLevel) => setFilterRiskLevel(riskLevel)}
                                                filterRiskLevel={filterRiskLevel}
                                            />
                                        </CardContent>
                                    </Card>

                                    <Card className="dashboard-block border-border bg-card" data-reveal>
                                        <CardHeader>
                                            <CardTitle className="text-sm font-medium">
                                                Présences
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <AttendancePieChart
                                                data={overview.attendanceDistribution}
                                            />
                                        </CardContent>
                                    </Card>

                                    <Card className="dashboard-block border-border bg-card" data-reveal>
                                        <CardHeader>
                                            <CardTitle className="text-sm font-medium">
                                                Moyennes par matière
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <InteractiveSubjectRadarChart
                                                data={overview.subjectSummary}
                                                onSubjectClick={(id, name) => setFilterSubjectId(id)}
                                                filterSubjectId={filterSubjectId}
                                            />
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </section>

                        {/* Section: Advanced Analytics */}
                        <section className="space-y-4 pt-6">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-primary" />
                                Analyses avancées
                            </h2>

                            <div className="grid grid-cols-1 gap-6">
                                {/* Multi-class Comparison */}
                                {Array.isArray(classes) && classes.length > 0 && (
                                    <MultiClassComparison
                                        classes={classes}
                                        academicYearId={overview?.academicYearId || ""}
                                    />
                                )}

                                {/* Scatter Plot: Attendance vs Grades */}
                                <AttendanceGradesScatter />

                                {/* Period Comparison */}
                                {selectedClassId && (
                                    <PeriodComparison
                                        academicYearId={overview?.academicYearId || ""}
                                        classId={selectedClassId}
                                        periods={overview?.periods || []}
                                    />
                                )}
                            </div>
                        </section>
                    </TabsContent>

                    <TabsContent value="risks">
                        <RiskInterventionTab 
                            atRiskStudents={riskStudents} 
                            academicYearId={overview?.academicYearId}
                        />
                    </TabsContent>

                    <TabsContent value="attendance">
                        <section className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <Card className="dashboard-block border-border bg-card">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Taux de présence</CardTitle></CardHeader>
                                    <CardContent><div className="text-3xl metric-serif text-[hsl(var(--success))]">{attendanceSummary.presentRate.toFixed(1)}%</div></CardContent>
                                </Card>
                                <Card className="dashboard-block border-border bg-card">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Taux d'absence</CardTitle></CardHeader>
                                    <CardContent><div className="text-3xl metric-serif text-destructive">{attendanceSummary.absentRate.toFixed(1)}%</div></CardContent>
                                </Card>
                                <Card className="dashboard-block border-border bg-card">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Retards</CardTitle></CardHeader>
                                    <CardContent><div className="text-3xl metric-serif">{attendanceSummary.late}</div></CardContent>
                                </Card>
                                <Card className="dashboard-block border-border bg-card">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total appels</CardTitle></CardHeader>
                                    <CardContent><div className="text-3xl metric-serif">{attendanceSummary.total}</div></CardContent>
                                </Card>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <Card className="dashboard-block border-border bg-card">
                                    <CardHeader><CardTitle className="text-sm font-medium">Corrélation assiduité / notes</CardTitle></CardHeader>
                                    <CardContent><AttendanceGradesScatter /></CardContent>
                                </Card>
                                <Card className="dashboard-block border-border bg-card">
                                    <CardHeader><CardTitle className="text-sm font-medium">Distribution des présences</CardTitle></CardHeader>
                                    <CardContent><AttendancePieChart data={overview?.attendanceDistribution || []} /></CardContent>
                                </Card>
                            </div>
                        </section>
                    </TabsContent>

                    <TabsContent value="finance">
                        <section className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <Card className="dashboard-block border-border bg-card">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Recouvrement</CardTitle></CardHeader>
                                    <CardContent><div className="text-3xl metric-serif text-[hsl(var(--success))]">{financeSummary.collectionRate.toFixed(1)}%</div></CardContent>
                                </Card>
                                <Card className="dashboard-block border-border bg-card">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Revenus</CardTitle></CardHeader>
                                    <CardContent><div className="text-3xl metric-serif">{financeSummary.totalRevenue.toLocaleString("fr-FR")}</div></CardContent>
                                </Card>
                                <Card className="dashboard-block border-border bg-card">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Impayés</CardTitle></CardHeader>
                                    <CardContent><div className="text-3xl metric-serif text-destructive">{financeSummary.totalPending.toLocaleString("fr-FR")}</div></CardContent>
                                </Card>
                                <Card className="dashboard-block border-border bg-card">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Croissance</CardTitle></CardHeader>
                                    <CardContent><div className="text-3xl metric-serif">{financeSummary.revenueGrowth.toFixed(1)}%</div></CardContent>
                                </Card>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <Card className="dashboard-block border-border bg-card">
                                    <CardHeader><CardTitle className="text-sm font-medium">Revenus par cycle</CardTitle></CardHeader>
                                    <CardContent>
                                        <RiskPieChart
                                            data={{
                                                low: financeSummary.revenueByCycle[0]?.value || 0,
                                                medium: financeSummary.revenueByCycle[1]?.value || 0,
                                                high: financeSummary.revenueByCycle[2]?.value || 0,
                                                critical: financeSummary.revenueByCycle.slice(3).reduce((sum: number, x: any) => sum + Number(x?.value || 0), 0),
                                            }}
                                        />
                                    </CardContent>
                                </Card>
                                <Card className="dashboard-block border-border bg-card">
                                    <CardHeader><CardTitle className="text-sm font-medium">Tendance mensuelle</CardTitle></CardHeader>
                                    <CardContent>
                                        <TrendLineChart
                                            data={financeSummary.revenueByMonth.map((item: any) => ({ name: item.month, value: Number(item.amount || 0) }))}
                                            label="Revenus"
                                        />
                                    </CardContent>
                                </Card>
                            </div>
                        </section>
                    </TabsContent>

                    <TabsContent value="comparisons">
                        <section className="space-y-6">
                            <Card className="dashboard-block border-border bg-card/90">
                                <CardContent className="py-4">
                                    <div className="flex flex-wrap items-center gap-4 text-sm">
                                        <span className="font-semibold text-foreground">Comparaison longitudinale</span>
                                        <span className="text-muted-foreground">Moyenne: {overview?.overview?.averageGrade ?? "0.00"} vs {compareOverview?.overview?.averageGrade ?? "0.00"}</span>
                                        <span className="text-muted-foreground">Échec: {overview?.overview?.failureRate ?? 0}% vs {compareOverview?.overview?.failureRate ?? 0}%</span>
                                        <span className="text-muted-foreground">À risque: {overview?.overview?.atRiskCount ?? 0} vs {compareOverview?.overview?.atRiskCount ?? 0}</span>
                                    </div>
                                </CardContent>
                            </Card>
                            <MultiClassComparison classes={Array.isArray(classes) ? classes : []} academicYearId={overview?.academicYearId || ""} />
                            {selectedClassId && (
                                <PeriodComparison
                                    academicYearId={overview?.academicYearId || ""}
                                    classId={selectedClassId}
                                    periods={overview?.periods || []}
                                />
                            )}
                        </section>
                    </TabsContent>

                    <TabsContent value="classes">
                        {/* Section 2: Analyse par classe */}
                        <section className="space-y-4">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <Users className="h-5 w-5 text-primary" />
                                Analyse par classe
                            </h2>

                            {classLoading && <Spinner />}
                            {classError && (
                                <ErrorAlert message="Erreur lors du chargement des données de la classe." />
                            )}

                            {classData && (
                                <>
                                    {/* KPIs */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Card className="border-border bg-card">
                                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                                    Moyenne de la classe
                                                </CardTitle>
                                                <GraduationCap className="w-4 h-4 text-secondary" />
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-2xl font-bold text-secondary">
                                                    {classData.averageGrade?.toFixed(1) ?? "—"}{" "}
                                                    / 20
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-border bg-card">
                                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                                    Nombre d&apos;élèves
                                                </CardTitle>
                                                <Users className="w-4 h-4 text-primary" />
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-2xl font-bold">
                                                    {classData.studentCount ?? "—"}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-border bg-card">
                                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                                    Meilleure matière
                                                </CardTitle>
                                                <TrendingUp className="w-4 h-4 text-accent" />
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-2xl font-bold">
                                                    {classData.subjectSummary?.[0]?.name ?? "—"}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Charts */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <Card className="border-border bg-card">
                                            <CardHeader>
                                                <CardTitle className="text-sm font-medium">
                                                    Performance de la classe
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <PerformanceBarChart
                                                    data={classData.performanceDistribution}
                                                />
                                            </CardContent>
                                        </Card>

                                        <Card className="border-border bg-card">
                                            <CardHeader>
                                                <CardTitle className="text-sm font-medium">
                                                    Moyennes par matière
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <SubjectRadarChart
                                                    data={classData.subjectSummary}
                                                />
                                            </CardContent>
                                        </Card>

                                        {classData.riskDistribution && (
                                            <Card className="border-border bg-card">
                                                <CardHeader>
                                                    <CardTitle className="text-sm font-medium">
                                                        Niveaux de risque
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <RiskPieChart data={classData.riskDistribution} />
                                                </CardContent>
                                            </Card>
                                        )}
                                    </div>

                                    {classData.monthlyTrend && (
                                        <Card className="border-border bg-card">
                                            <CardHeader>
                                                <CardTitle className="text-sm font-medium">
                                                    Évolution mensuelle
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <TrendLineChart data={classData.monthlyTrend} />
                                            </CardContent>
                                        </Card>
                                    )}

                                    {/* Student Ranking Table */}
                                    {classData.studentRanking &&
                                        classData.studentRanking.length > 0 && (
                                            <Card className="border-border bg-card">
                                                <CardHeader>
                                                    <CardTitle className="text-sm font-medium">
                                                        Classement des élèves
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-sm">
                                                            <thead>
                                                                <tr className="border-b border-border">
                                                                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                                                                        Rang
                                                                    </th>
                                                                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                                                                        Nom
                                                                    </th>
                                                                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                                                                        Moyenne
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {classData.studentRanking.map(
                                                                    (
                                                                        student: {
                                                                            studentId: string;
                                                                            rank: number;
                                                                            name: string;
                                                                            average: number;
                                                                        },
                                                                        idx: number
                                                                    ) => (
                                                                        <tr
                                                                            key={student.studentId || idx}
                                                                            className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                                                                        >
                                                                            <td className="py-2 px-3 font-medium">
                                                                                {student.rank ??
                                                                                    idx + 1}
                                                                            </td>
                                                                            <td className="py-2 px-3">
                                                                                {student.name}
                                                                            </td>
                                                                            <td className="py-2 px-3 text-right font-medium">
                                                                                {student.average?.toFixed(
                                                                                    1
                                                                                )}{" "}
                                                                                / 20
                                                                            </td>
                                                                        </tr>
                                                                    )
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )}
                                </>
                            )}
                        </section>
                    </TabsContent>

                    <TabsContent value="subjects">
                        {/* Section 3: Analyse par matière */}
                        {selectedClassId && selectedSubjectId && (
                            <section className="space-y-4">
                                <h2 className="text-lg font-semibold flex items-center gap-2">
                                    <GraduationCap className="h-5 w-5 text-primary" />
                                    Analyse par matière
                                </h2>

                                {subjectLoading && <Spinner />}
                                {subjectError && (
                                    <ErrorAlert message="Erreur lors du chargement des données de la matière." />
                                )}

                                {subjectData && (
                                    <>
                                        {/* KPIs */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <Card className="border-border bg-card">
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                                        Moyenne
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="text-2xl font-bold text-secondary">
                                                        {subjectData.average?.toFixed(1) ?? "—"} / 20
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            <Card className="border-border bg-card">
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                                        Plus haute
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="text-2xl font-bold text-green-600">
                                                        {subjectData.highest?.toFixed(1) ?? "—"} / 20
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            <Card className="border-border bg-card">
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                                        Plus basse
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="text-2xl font-bold text-red-600">
                                                        {subjectData.lowest?.toFixed(1) ?? "—"} / 20
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            <Card className="border-border bg-card">
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                                        Médiane
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="text-2xl font-bold">
                                                        {subjectData.median?.toFixed(1) ?? "—"} / 20
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>

                                        {/* Grade Distribution Chart */}
                                        {subjectData.gradeDistribution && (
                                            <Card className="border-border bg-card">
                                                <CardHeader>
                                                    <CardTitle className="text-sm font-medium">
                                                        Distribution des notes
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <PerformanceBarChart
                                                        data={subjectData.gradeDistribution}
                                                    />
                                                </CardContent>
                                            </Card>
                                        )}

                                        {/* Student Grades Table */}
                                        {subjectData.studentGrades &&
                                            subjectData.studentGrades.length > 0 && (
                                                <Card className="border-border bg-card">
                                                    <CardHeader>
                                                        <CardTitle className="text-sm font-medium">
                                                            Notes par élève
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-sm">
                                                                <thead>
                                                                    <tr className="border-b border-border">
                                                                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                                                                            Rang
                                                                        </th>
                                                                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                                                                            Nom
                                                                        </th>
                                                                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                                                                            Moyenne
                                                                        </th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {subjectData.studentGrades.map(
                                                                        (
                                                                            student: {
                                                                                studentId: string;
                                                                                rank: number;
                                                                                studentName: string;
                                                                                average: number;
                                                                            },
                                                                            idx: number
                                                                        ) => (
                                                                            <tr
                                                                                key={student.studentId || idx}
                                                                                className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                                                                            >
                                                                                <td className="py-2 px-3 font-medium">
                                                                                    {student.rank ??
                                                                                        idx + 1}
                                                                                </td>
                                                                                <td className="py-2 px-3">
                                                                                    {student.studentName}
                                                                                </td>
                                                                                <td className="py-2 px-3 text-right font-medium">
                                                                                    {student.average?.toFixed(
                                                                                        1
                                                                                    )}{" "}
                                                                                    / 20
                                                                                </td>
                                                                            </tr>
                                                                        )
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )}
                                    </>
                                )}
                            </section>
                        )}
                    </TabsContent>

                    <TabsContent value="reports">
                        <section className="space-y-6">
                            <Card className="dashboard-block border-border bg-card">
                                <CardHeader>
                                    <CardTitle className="text-base">Générateur de rapports personnalisés</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <input
                                        value={reportTitle}
                                        onChange={(e) => setReportTitle(e.target.value)}
                                        className={selectClass}
                                        placeholder="Titre du rapport"
                                    />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                        {[
                                            { key: "overview", label: "Inclure synthèse globale" },
                                            { key: "risks", label: "Inclure risques & décrochage" },
                                            { key: "attendance", label: "Inclure assiduité" },
                                            { key: "finance", label: "Inclure finances" },
                                        ].map((item) => (
                                            <label key={item.key} className="flex items-center gap-2 rounded-md border border-border/70 p-3">
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(reportBlocks[item.key])}
                                                    onChange={() => toggleReportBlock(item.key)}
                                                />
                                                <span>{item.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button className="touch-target action-critical" onClick={() => exportCustomReport("pdf")}>
                                            <FileText className="h-4 w-4 mr-2" />
                                            Export PDF
                                        </Button>
                                        <Button variant="outline" className="touch-target" onClick={() => exportCustomReport("csv")}>
                                            <Download className="h-4 w-4 mr-2" />
                                            Export CSV
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </section>
                    </TabsContent>
                </Tabs>
            </div>
        </PageGuard>
    );
}
