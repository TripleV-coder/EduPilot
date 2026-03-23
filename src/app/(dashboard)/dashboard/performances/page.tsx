"use client";

import { useEffect, useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { exportToCSV, exportToPDF } from "@/lib/utils/export";
import { LineChart, BarChart3, TrendingUp, Trophy, BookOpen, AlertCircle, Loader2, Filter, Download } from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Cell
} from "recharts";


type PerformanceStats = {
    academicYear: string;
    terms: { id: string; name: string }[];
    activeTermId: string;
    overallAverage: number;
    totalEvaluations: number;
    performanceByLevel: { name: string; average: number }[];
    performanceByClass: { name: string; average: number }[];
    performanceBySubject: { name: string; average: number }[];
};

export default function PerformancesPage() {
    const [stats, setStats] = useState<PerformanceStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [academicYears, setAcademicYears] = useState<any[]>([]);
    const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>("ALL");
    const [selectedPeriodId, setSelectedPeriodId] = useState<string>("ALL");

    useEffect(() => {
        fetch("/api/academic-years")
            .then(r => r.ok ? r.json() : [])
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    setAcademicYears(data);
                    const currentYear = data.find((y: any) => y.isCurrent);
                    if (currentYear) setSelectedAcademicYearId(currentYear.id);
                }
            })
            .catch(() => { });
    }, []);

    useEffect(() => {
        let cancelled = false;
        queueMicrotask(() => {
            if (!cancelled) setLoading(true);
        });

        const params = new URLSearchParams();
        if (selectedAcademicYearId !== "ALL") params.set("academicYearId", selectedAcademicYearId);
        if (selectedPeriodId !== "ALL") params.set("periodId", selectedPeriodId);

        fetch(`/api/performances?${params.toString()}`, { credentials: "include" })
            .then((r) => {
                if (!r.ok) throw new Error("Erreur de chargement des statistiques de performance");
                return r.json();
            })
            .then((data) => {
                if (!cancelled) {
                    setStats(data);
                    if (selectedPeriodId === "ALL" && data.activePeriodId) {
                        setSelectedPeriodId(data.activePeriodId);
                    }
                }
            })
            .catch((e) => {
                if (!cancelled) setError(e.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [selectedAcademicYearId, selectedPeriodId]);

    const handleYearChange = (yearId: string) => {
        setSelectedAcademicYearId(yearId);
        setSelectedPeriodId("ALL"); // Reset period on year change
    };

    const handleExportPerformances = (format: "csv" | "pdf") => {
        if (!stats) return;

        const data = {
            title: "Rapport de Performances Pédagogiques",
            headers: ["Catégorie", "Valeur"],
            rows: [
                ["Moyenne Générale", `${stats.overallAverage}/20`],
                ["Volume de Notes", stats.totalEvaluations],
                ["Nombre de Niveaux", stats.performanceByLevel.length],
                ["Nombre de Classes", stats.performanceByClass.length],
                ["Nombre de Matières", stats.performanceBySubject.length],
            ] as (string | number)[][],
        };

        if (format === "csv") {
            exportToCSV(data);
        } else {
            exportToPDF(data);
        }
    };

    const getColorForAverage = (avg: number) => {
        if (avg >= 14) return "#22c55e"; // Vert
        if (avg >= 10) return "#F97316"; // Primary
        if (avg >= 8) return "#f59e0b";  // Orange
        return "#ef4444";            // Rouge
    };

    return (
        <PageGuard permission={Permission.GRADE_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}>
            <div className="space-y-6 max-w-7xl mx-auto pb-12">
                <PageHeader
                    title="Performances Pédagogiques"
                    description="Analyse des résultats scolaires, suivi des moyennes par classe, niveau et matière."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Pédagogie" },
                        { label: "Performances" },
                    ]}
                />

                {/* Filtres de Performance */}
                <Card className="border-border shadow-sm">
                    <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/20">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Filter className="h-4 w-4" />
                            <span className="text-sm font-medium">Filtres</span>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
                            <Select value={selectedAcademicYearId} onValueChange={handleYearChange}>
                                <SelectTrigger className="w-[200px] bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Toutes les années</SelectItem>
                                    {academicYears.map((year: any) => (
                                        <SelectItem key={year.id} value={year.id}>
                                            {year.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select
                                value={selectedPeriodId}
                                onValueChange={setSelectedPeriodId}
                                disabled={selectedAcademicYearId === "ALL" || !stats || stats.terms?.length === 0}
                            >
                                <SelectTrigger className="w-[180px] bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Toute l'année</SelectItem>
                                    {stats?.terms?.map((period: any) => (
                                        <SelectItem key={period.id} value={period.id}>
                                            {period.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex gap-2 ml-auto">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleExportPerformances("csv")}
                                disabled={!stats}
                                className="gap-2"
                            >
                                <Download className="h-4 w-4" />
                                CSV
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleExportPerformances("pdf")}
                                disabled={!stats}
                                className="gap-2"
                            >
                                <Download className="h-4 w-4" />
                                PDF
                            </Button>
                        </div>
                    </div>
                </Card>

                {loading && (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                )}

                {error && (
                    <div className="rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] px-4 py-3 text-sm text-destructive flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        <p>{error}</p>
                    </div>
                )}

                {!loading && !error && stats && (
                    <div className="space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Card className="shadow-sm border-border bg-gradient-to-br from-primary/10 via-background to-background">
                                <CardContent className="p-6">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-muted-foreground">Moyenne Générale</p>
                                            <p className="text-3xl font-bold tracking-tight text-foreground">
                                                {stats.overallAverage}/20
                                            </p>
                                        </div>
                                        <div className="p-2 bg-primary/20 rounded-lg">
                                            <TrendingUp className="h-5 w-5 text-primary" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="shadow-sm border-border">
                                <CardContent className="p-6">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-muted-foreground">Volumes de Notes</p>
                                            <p className="text-3xl font-bold tracking-tight text-foreground">
                                                {stats.totalEvaluations}
                                            </p>
                                        </div>
                                        <div className="p-2 bg-muted rounded-lg">
                                            <BarChart3 className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="shadow-sm border-border">
                                <CardContent className="p-6">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-muted-foreground">Meilleure Matière</p>
                                            <p className="text-lg font-bold tracking-tight text-foreground truncate max-w-[150px]">
                                                {stats.performanceBySubject?.[0]?.name || "N/A"}
                                            </p>
                                            <p className="text-xs font-semibold text-emerald-600 bg-emerald-500/10 w-fit px-2 py-0.5 rounded-full">
                                                {stats.performanceBySubject?.[0]?.average || "0"}/20
                                            </p>
                                        </div>
                                        <div className="p-2 bg-emerald-500/20 rounded-lg">
                                            <BookOpen className="h-5 w-5 text-emerald-600" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="shadow-sm border-border">
                                <CardContent className="p-6">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-muted-foreground">Meilleure Classe</p>
                                            <p className="text-lg font-bold tracking-tight text-foreground truncate max-w-[150px]">
                                                {stats.performanceByClass?.[0]?.name || "N/A"}
                                            </p>
                                            <p className="text-xs font-semibold text-amber-600 bg-amber-500/10 w-fit px-2 py-0.5 rounded-full">
                                                {stats.performanceByClass?.[0]?.average || "0"}/20
                                            </p>
                                        </div>
                                        <div className="p-2 bg-amber-500/20 rounded-lg">
                                            <Trophy className="h-5 w-5 text-amber-600" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Charts Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                            {/* Performance By Class */}
                            <Card className="shadow-sm border-border">
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <LineChart className="w-5 h-5 text-primary" />
                                        Top 10 : Moyennes par Classe
                                    </CardTitle>
                                    <CardDescription>Comparaison des performances globales entre les classes</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-[300px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={stats.performanceByClass} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickMargin={10} axisLine={false} tickLine={false} />
                                                <YAxis domain={[0, 20]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                                <Tooltip
                                                    cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                                                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                />
                                                <Bar dataKey="average" name="Moyenne" radius={[4, 4, 0, 0]}>
                                                    {stats.performanceByClass.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={getColorForAverage(entry.average)} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Performance By Subject */}
                            <Card className="shadow-sm border-border">
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <BookOpen className="w-5 h-5 text-primary" />
                                        Top 10 : Moyennes par Matière
                                    </CardTitle>
                                    <CardDescription>Les matières où les élèves réussissent le mieux</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-[300px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart layout="vertical" data={stats.performanceBySubject} margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                                                <XAxis type="number" domain={[0, 20]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                                <YAxis 
                                                    type="category" 
                                                    dataKey="name" 
                                                    tick={{ fontSize: 10 }} 
                                                    width={140} 
                                                    axisLine={false} 
                                                    tickLine={false}
                                                    tickFormatter={(value) => value.length > 20 ? `${value.substring(0, 18)}...` : value}
                                                />
                                                <Tooltip
                                                    cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                                                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                />
                                                <Bar dataKey="average" name="Moyenne" radius={[0, 4, 4, 0]}>
                                                    {stats.performanceBySubject.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={getColorForAverage(entry.average)} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                        </div>

                        {/* Performance By Level */}
                        <Card className="shadow-sm border-border">
                            <CardHeader>
                                <CardTitle className="text-lg">Moyennes par Niveau d'Étude</CardTitle>
                                <CardDescription>Vue macroscopique des résultats de l'établissement</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[250px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats.performanceByLevel} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                            <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                            <YAxis domain={[0, 20]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                            <Tooltip
                                                cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                                                contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                                            />
                                            <Bar dataKey="average" name="Moyenne" radius={[4, 4, 0, 0]} fill="#F97316" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                    </div>
                )}
            </div>
        </PageGuard>
    );
}
