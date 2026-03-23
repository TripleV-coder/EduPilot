"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { motion } from "framer-motion";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Permission } from "@/lib/rbac/permissions";
import { useDebounce } from "@/hooks/use-debounce";
import {
    Shield, Search, Loader2, Plus, AlertTriangle, MessageSquareWarning,
    FileWarning, CheckCircle2, MoreVertical, MapPin, CalendarClock, User, Filter, ArrowUpDown,
    BarChart3, Clock, TrendingUp, TrendingDown
} from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { RiskPieChart } from "@/components/charts/RiskPieChart";
import { CategoryPieChart } from "@/components/charts/CategoryPieChart";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { PageCallout } from "@/components/layout/page-callout";
import { formatUserRoleLabel } from "@/lib/utils/role-label";
import { t } from "@/lib/i18n";

type Incident = {
    id: string;
    incidentType: string;
    severity: string;
    date: string;
    location: string | null;
    description: string;
    actionTaken: string | null;
    isResolved: boolean;
    student: {
        user: { firstName: string; lastName: string; };
    };
    reportedBy: {
        firstName: string; lastName: string; role: string;
    };
};

export default function IncidentsPage() {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters states
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearch = useDebounce(searchTerm, 500);
    const [selectedType, setSelectedType] = useState<string>("ALL");
    const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
    const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
    const [selectedPeriodId, setSelectedPeriodId] = useState<string>("ALL");
    const [periods, setPeriods] = useState<any[]>([]);
    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (selectedPeriodId !== "ALL") count += 1;
        if (selectedSeverity !== "ALL") count += 1;
        if (selectedType !== "ALL") count += 1;
        if (selectedStatus !== "ALL") count += 1;
        if (searchTerm.trim()) count += 1;
        return count;
    }, [searchTerm, selectedPeriodId, selectedSeverity, selectedType, selectedStatus]);

    const markIncidentTransition = (incidentId: string) => {
        if (typeof window === "undefined") return;
        window.sessionStorage.setItem("edupilot-incident-transition", incidentId);
    };
    const resetFilters = () => {
        setSearchTerm("");
        setSelectedType("ALL");
        setSelectedSeverity("ALL");
        setSelectedStatus("ALL");
        setSelectedPeriodId("ALL");
    };

    // Fetch incident statistics
    const { data: statsData } = useSWR<any>("/api/incidents/statistics?period=month", fetcher);

    useEffect(() => {
        // Fetch current academic year periods
        fetch("/api/periods")
            .then(res => res.ok ? res.json() : [])
            .then(data => {
                if (Array.isArray(data)) setPeriods(data);
            })
            .catch(() => { });
    }, []);

    useEffect(() => {
        fetchIncidents();
    }, [debouncedSearch, selectedType, selectedSeverity, selectedStatus, selectedPeriodId]);

    const fetchIncidents = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: "50" });
            if (selectedType !== "ALL") params.set("incidentType", selectedType);
            if (selectedSeverity !== "ALL") params.set("severity", selectedSeverity);
            if (selectedStatus !== "ALL") {
                params.set("resolved", selectedStatus === "RESOLVED" ? "true" : "false");
            }
            if (selectedPeriodId !== "ALL") params.set("periodId", selectedPeriodId);

            const res = await fetch(`/api/incidents?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();

                let filtered = data.incidents || [];
                if (debouncedSearch) {
                    const l = debouncedSearch.toLowerCase();
                    filtered = filtered.filter((i: Incident) =>
                        i.student.user.firstName.toLowerCase().includes(l) ||
                        i.student.user.lastName.toLowerCase().includes(l)
                    );
                }
                setIncidents(filtered);
            }
        } catch (error) {
            console.error("Failed to fetch incidents", error);
        } finally {
            setLoading(false);
        }
    };

    const getSeverityDetails = (severity: string) => {
        switch (severity) {
            case "CRITICAL": return { color: "bg-red-500/10 text-red-600 border-red-500/20", label: "Critique" };
            case "HIGH": return { color: "bg-orange-500/10 text-orange-600 border-orange-500/20", label: "Majeur" };
            case "MEDIUM": return { color: "bg-amber-500/10 text-amber-600 border-amber-500/20", label: "Moyen" };
            case "LOW": return { color: "bg-blue-500/10 text-blue-600 border-blue-500/20", label: "Mineur" };
            default: return { color: "bg-slate-500/10 text-slate-600", label: severity };
        }
    };

    const getTypeLabel = (type: string) => {
        const types: Record<string, string> = {
            "LATE": "Retard", "ABSENCE_UNEXCUSED": "Absence Injustifiée",
            "DISRESPECT": "Manque de respect", "DISRUPTION": "Perturbation de cours",
            "CHEATING": "Tricherie / Fraude", "BULLYING": "Harcèlement",
            "VIOLENCE": "Violence physique/verbale", "VANDALISM": "Vandalisme",
            "THEFT": "Vol", "SUBSTANCE": "Substances illicites",
            "INAPPROPRIATE_LANGUAGE": "Langage grossier", "DRESS_CODE": "Tenue non-conforme",
            "TECHNOLOGY_MISUSE": "Usage interdit du téléphone", "OTHER": "Autre"
        };
        return types[type] || type;
    };

    // Prepare chart data from statistics
    const severityData = statsData?.statistics?.bySeverity
        ? { low: statsData.statistics.bySeverity.LOW || 0, medium: statsData.statistics.bySeverity.MEDIUM || 0, high: statsData.statistics.bySeverity.HIGH || 0, critical: statsData.statistics.bySeverity.CRITICAL || 0 }
        : { low: 0, medium: 0, high: 0, critical: 0 };

    const typeChartData = statsData?.topIncidentTypes
        ? statsData.topIncidentTypes.map(([type, count]: [string, number]) => ({ name: getTypeLabel(type), value: count }))
        : [];

    const trendData = statsData?.dailyTrend
        ? Object.entries(statsData.dailyTrend)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, count]) => ({ name: new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }), value: count as number }))
        : [];

    const stats = statsData?.statistics;

    const incidentColumns: ColumnDef<Incident>[] = [
        {
            id: "student",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Élève <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            accessorFn: (row) => `${row.student?.user.firstName} ${row.student?.user.lastName}`,
            cell: ({ row }) => {
                const i = row.original;
                return (
                    <div className="font-semibold text-foreground flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                            {i.student?.user.firstName[0]}{i.student?.user.lastName[0]}
                        </div>
                        {i.student?.user.firstName} {i.student?.user.lastName}
                    </div>
                );
            },
        },
        {
            id: "type",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Type <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            accessorFn: (row) => getTypeLabel(row.incidentType),
            cell: ({ row }) => {
                const sev = getSeverityDetails(row.original.severity);
                return (
                    <div className="flex flex-col gap-1.5">
                        <span className="font-medium text-foreground">{getTypeLabel(row.original.incidentType)}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border w-fit uppercase ${sev.color}`}>
                            {sev.label}
                        </span>
                    </div>
                );
            },
        },
        {
            id: "date",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Date <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            accessorFn: (row) => new Date(row.date).getTime(),
            cell: ({ row }) => {
                const i = row.original;
                return (
                    <div className="flex flex-col gap-1 text-muted-foreground text-xs">
                        <span className="flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> {new Date(i.date).toLocaleDateString("fr-FR", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        {i.location && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {i.location}</span>}
                    </div>
                );
            },
        },
        {
            id: "reportedBy",
            header: "Signalé par",
            accessorFn: (row) => `${row.reportedBy.firstName} ${row.reportedBy.lastName}`,
            cell: ({ row }) => {
                const i = row.original;
                return (
                    <div className="flex flex-col">
                        <span className="text-sm font-medium">{i.reportedBy.firstName} {i.reportedBy.lastName}</span>
                        <span className="text-xs text-muted-foreground">{formatUserRoleLabel(i.reportedBy.role)}</span>
                    </div>
                );
            },
        },
        {
            id: "status",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Statut <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            accessorFn: (row) => row.isResolved ? "Résolu" : "En attente",
            cell: ({ row }) => {
                const i = row.original;
                return i.isResolved ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Résolu
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-full">
                        <AlertTriangle className="w-3.5 h-3.5" /> En attente
                    </span>
                );
            },
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => (
                <Button variant="ghost" size="icon" asChild>
                    <Link href={`/dashboard/incidents/${row.original.id}`} onClick={() => markIncidentTransition(row.original.id)}>
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                    </Link>
                </Button>
            ),
        },
    ];

    return (
        <PageGuard permission={Permission.SCHOOL_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "PARENT", "STUDENT"]}>
            <motion.div
                className="space-y-6 max-w-7xl mx-auto pb-12"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
                <PageHeader
                    title="Vie Scolaire & Discipline"
                    description="Suivez les incidents disciplinaires, retards, et sanctions des élèves."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Vie Scolaire" },
                        { label: "Incidents" },
                    ]}
                    actions={
                        <RoleActionGuard allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}>
                            <Button className="gap-2 touch-target action-critical" asChild>
                                <Link href="/dashboard/incidents/new">
                                    <Plus className="w-4 h-4" /> Signaler un incident
                                </Link>
                            </Button>
                        </RoleActionGuard>
                    }
                />

                {/* KPI Cards */}
                {stats && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="shadow-sm">
                            <CardContent className="pt-5 pb-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Incidents</p>
                                        <p className="text-2xl font-bold mt-1">{stats.totalIncidents}</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                        <BarChart3 className="w-5 h-5 text-primary" />
                                    </div>
                                </div>
                                {statsData?.trend && statsData.trend !== "stable" && (
                                    <div className={`flex items-center gap-1 mt-2 text-xs ${statsData.trend === "up" ? "text-red-500" : "text-emerald-500"}`}>
                                        {statsData.trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {statsData.trend === "up" ? "En hausse" : "En baisse"} vs période précédente
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm">
                            <CardContent className="pt-5 pb-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Résolus</p>
                                        <p className="text-2xl font-bold mt-1 text-emerald-600">{stats.resolvedCount}</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    {stats.totalIncidents > 0 ? Math.round((stats.resolvedCount / stats.totalIncidents) * 100) : 0}% du total
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm">
                            <CardContent className="pt-5 pb-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">En attente</p>
                                        <p className="text-2xl font-bold mt-1 text-amber-600">{stats.unresolvedCount}</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    {stats.totalIncidents > 0 ? Math.round((stats.unresolvedCount / stats.totalIncidents) * 100) : 0}% du total
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm">
                            <CardContent className="pt-5 pb-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Résolution moy.</p>
                                        <p className="text-2xl font-bold mt-1">{stats.averageResolutionTime > 0 ? `${Math.round(stats.averageResolutionTime)}h` : "—"}</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                                        <Clock className="w-5 h-5 text-blue-500" />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">Temps moyen de résolution</p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Charts Row */}
                {stats && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card className="shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold">Par sévérité</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <RiskPieChart data={severityData} />
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold">Par type d&apos;incident</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CategoryPieChart data={typeChartData} />
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold">Tendance journalière</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <TrendLineChart data={trendData} label="Incidents" domain={[0, Math.max(10, ...trendData.map((d: any) => d.value))]} />
                            </CardContent>
                        </Card>
                    </div>
                )}

                <Card className="shadow-sm border-border overflow-hidden">
                    <div className="p-4 border-b bg-muted/20 flex flex-col xl:flex-row items-center justify-between gap-4">
                        <div className="relative w-full xl:max-w-xs shrink-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                
                                className="pl-9 bg-background touch-target"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-3 w-full overflow-x-auto pb-2 xl:pb-0">
                            <div className="flex items-center gap-2 text-muted-foreground hidden lg:flex">
                                <Filter className="h-4 w-4" />
                            </div>

                            <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                                <SelectTrigger className="w-[140px] bg-background touch-target">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Toute l&apos;année</SelectItem>
                                    {periods.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
                                <SelectTrigger className="w-[140px] bg-background touch-target">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Toute gravité</SelectItem>
                                    <SelectItem value="CRITICAL">Critique</SelectItem>
                                    <SelectItem value="HIGH">Majeur</SelectItem>
                                    <SelectItem value="MEDIUM">Moyen</SelectItem>
                                    <SelectItem value="LOW">Mineur</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={selectedType} onValueChange={setSelectedType}>
                                <SelectTrigger className="w-[160px] bg-background touch-target">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Tous les types</SelectItem>
                                    <SelectItem value="ABSENCE_UNEXCUSED">Absence Injustifiée</SelectItem>
                                    <SelectItem value="LATE">Retard</SelectItem>
                                    <SelectItem value="DISRESPECT">Manque de respect</SelectItem>
                                    <SelectItem value="DISRUPTION">Perturbation</SelectItem>
                                    <SelectItem value="CHEATING">Tricherie / Fraude</SelectItem>
                                    <SelectItem value="VIOLENCE">Violence</SelectItem>
                                    <SelectItem value="OTHER">Autre</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                <SelectTrigger className="w-[140px] bg-background touch-target">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Tous les statuts</SelectItem>
                                    <SelectItem value="UNRESOLVED">En attente</SelectItem>
                                    <SelectItem value="RESOLVED">Résolu</SelectItem>
                                </SelectContent>
                            </Select>
                            {activeFiltersCount > 0 && (
                                <>
                                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                        {activeFiltersCount} filtre{activeFiltersCount > 1 ? "s" : ""}
                                    </span>
                                    <Button variant="ghost" size="sm" className="touch-target" onClick={resetFilters}>
                                        {t("common.reset")}
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-4 space-y-3">
                            {Array.from({ length: 8 }).map((_, idx) => (
                                <div key={idx} className="h-14 rounded-lg bg-muted/40 skeleton-shimmer" />
                            ))}
                        </div>
                    ) : incidents.length === 0 ? (
                        <div className="p-6">
                            <PageCallout
                                icon={Shield}
                                title="Aucun incident récent"
                                description="Aucun incident n’a été signalé avec ces filtres. Si besoin, vous pouvez déclarer un nouvel incident pour alimenter le suivi disciplinaire."
                                actions={[{ label: "Signaler un incident", href: "/dashboard/incidents/new" }]}
                            />
                        </div>
                    ) : (
                        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                            <DataTable columns={incidentColumns} data={incidents} />
                        </motion.div>
                    )}
                </Card>
            </motion.div>
        </PageGuard>
    );
}
