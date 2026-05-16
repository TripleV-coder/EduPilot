"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import {
    Shield, Search, Plus, AlertTriangle, CheckCircle2, MoreVertical, MapPin, CalendarClock, Filter, ArrowUpDown,
    BarChart3, Clock
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
import { getIncidentSeverityClass } from "@/lib/ui/status-styles";
import { PageHeader } from "@/components/layout/page-header";

export type Incident = {
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

export type IncidentStats = {
    totalIncidents: number;
    resolvedCount: number;
    unresolvedCount: number;
    averageResolutionTime: number;
    bySeverity: {
        LOW: number;
        MEDIUM: number;
        HIGH: number;
        CRITICAL: number;
    };
    topIncidentTypes?: [string, number][];
    dailyTrend?: Record<string, number>;
};

export type PeriodItem = {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
};

interface IncidentsClientProps {
    initialIncidents: Incident[];
    stats: IncidentStats;
    periods: PeriodItem[];
}

export function IncidentsClient({ initialIncidents, stats: statsData, periods }: IncidentsClientProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearch = useDebounce(searchTerm, 500);
    const [selectedType, setSelectedType] = useState<string>("ALL");
    const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
    const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
    const [selectedPeriodId, setSelectedPeriodId] = useState<string>("ALL");

    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (selectedPeriodId !== "ALL") count += 1;
        if (selectedSeverity !== "ALL") count += 1;
        if (selectedType !== "ALL") count += 1;
        if (selectedStatus !== "ALL") count += 1;
        if (searchTerm.trim()) count += 1;
        return count;
    }, [searchTerm, selectedPeriodId, selectedSeverity, selectedType, selectedStatus]);

    const resetFilters = () => {
        setSearchTerm("");
        setSelectedType("ALL");
        setSelectedSeverity("ALL");
        setSelectedStatus("ALL");
        setSelectedPeriodId("ALL");
    };

    const markIncidentTransition = (incidentId: string) => {
        if (typeof window === "undefined") return;
        window.sessionStorage.setItem("edupilot-incident-transition", incidentId);
    };

    const getSeverityDetails = (severity: string) => {
        switch (severity) {
            case "CRITICAL": return { color: getIncidentSeverityClass(severity), label: t("incidents.severity.critical") };
            case "HIGH": return { color: getIncidentSeverityClass(severity), label: t("incidents.severity.high") };
            case "MEDIUM": return { color: getIncidentSeverityClass(severity), label: t("incidents.severity.medium") };
            case "LOW": return { color: getIncidentSeverityClass(severity), label: t("incidents.severity.low") };
            default: return { color: getIncidentSeverityClass(severity), label: severity };
        }
    };

    const getTypeLabel = (type: string) => {
        return t(`incidents.types.${type}`, { defaultValue: type });
    };

    const filteredIncidents = useMemo(() => {
        return initialIncidents.filter(i => {
            if (selectedType !== "ALL" && i.incidentType !== selectedType) return false;
            if (selectedSeverity !== "ALL" && i.severity !== selectedSeverity) return false;
            if (selectedStatus !== "ALL") {
                const isResolved = selectedStatus === "RESOLVED";
                if (i.isResolved !== isResolved) return false;
            }
            if (debouncedSearch) {
                const l = debouncedSearch.toLowerCase();
                const fullName = `${i.student.user.firstName} ${i.student.user.lastName}`.toLowerCase();
                if (!fullName.includes(l)) return false;
            }
            return true;
        });
    }, [initialIncidents, debouncedSearch, selectedType, selectedSeverity, selectedStatus]);

    const severityData = statsData?.bySeverity
        ? { low: statsData.bySeverity.LOW || 0, medium: statsData.bySeverity.MEDIUM || 0, high: statsData.bySeverity.HIGH || 0, critical: statsData.bySeverity.CRITICAL || 0 }
        : { low: 0, medium: 0, high: 0, critical: 0 };

    const typeChartData = statsData?.topIncidentTypes
        ? statsData.topIncidentTypes.map(([type, count]) => ({ name: getTypeLabel(type), value: count }))
        : [];

    const trendData = statsData?.dailyTrend
        ? Object.entries(statsData.dailyTrend)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, count]) => ({ name: new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }), value: count }))
        : [];

    const incidentColumns: ColumnDef<Incident>[] = [
        {
            id: "student",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    {t("common.student")} <ArrowUpDown className="ml-2 h-4 w-4" />
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
                    {t("common.type")} <ArrowUpDown className="ml-2 h-4 w-4" />
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
                    {t("common.date")} <ArrowUpDown className="ml-2 h-4 w-4" />
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
            header: t("incidents.table.reportedBy"),
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
                    {t("common.status")} <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            accessorFn: (row) => row.isResolved ? t("incidents.filters.resolved") : t("incidents.filters.unresolved"),
            cell: ({ row }) => {
                const i = row.original;
                return i.isResolved ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success bg-success/10 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {t("incidents.filters.resolved")}
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-warning bg-warning/10 px-2.5 py-1 rounded-full">
                        <AlertTriangle className="w-3.5 h-3.5" /> {t("incidents.filters.unresolved")}
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
        <motion.div
            className="space-y-6 max-w-7xl mx-auto pb-12"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        >
            <PageHeader
                title={t("incidents.title")}
                description={t("incidents.description")}
                breadcrumbs={[
                    { label: t("breadcrumbs.dashboard"), href: "/dashboard" },
                    { label: t("breadcrumbs.incidents") },
                ]}
                actions={
                    <RoleActionGuard allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}>
                        <Button className="gap-2 touch-target action-critical" asChild>
                            <Link href="/dashboard/incidents/new">
                                <Plus className="w-4 h-4" /> {t("incidents.actions.report")}
                            </Link>
                        </Button>
                    </RoleActionGuard>
                }
            />

            {/* KPI Cards */}
            {statsData && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="shadow-sm">
                        <CardContent className="pt-5 pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("incidents.stats.total")}</p>
                                    <p className="text-2xl font-bold mt-1">{statsData.totalIncidents}</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <BarChart3 className="w-5 h-5 text-primary" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="shadow-sm">
                        <CardContent className="pt-5 pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("incidents.stats.resolved")}</p>
                                    <p className="text-2xl font-bold mt-1 text-success">{statsData.resolvedCount}</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                                    <CheckCircle2 className="w-5 h-5 text-success" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="shadow-sm">
                        <CardContent className="pt-5 pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("incidents.stats.pending")}</p>
                                    <p className="text-2xl font-bold mt-1 text-warning">{statsData.unresolvedCount}</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                                    <AlertTriangle className="w-5 h-5 text-warning" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="shadow-sm">
                        <CardContent className="pt-5 pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("incidents.stats.avgResolution")}</p>
                                    <p className="text-2xl font-bold mt-1">{statsData.averageResolutionTime > 0 ? `${Math.round(statsData.averageResolutionTime)}h` : "—"}</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-primary" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Charts Row */}
            {statsData && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Card className="shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold">{t("incidents.charts.bySeverity")}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <RiskPieChart data={severityData} />
                        </CardContent>
                    </Card>
                    <Card className="shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold">{t("incidents.charts.byType")}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CategoryPieChart data={typeChartData} />
                        </CardContent>
                    </Card>
                    <Card className="shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold">{t("incidents.charts.dailyTrend")}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <TrendLineChart data={trendData} label="Incidents" domain={[0, Math.max(10, ...trendData.map((d) => d.value))]} />
                        </CardContent>
                    </Card>
                </div>
            )}

            <Card className="shadow-sm border-border overflow-hidden">
                <div className="p-4 border-b bg-muted/20 flex flex-col xl:flex-row items-center justify-between gap-4">
                    <div className="relative w-full xl:max-w-xs shrink-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            aria-label={t("incidents.filters.student")}
                            placeholder={t("incidents.filters.student")}
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
                            <SelectTrigger className="w-[140px] bg-background touch-target" aria-label={t("incidents.filters.allYear")}>
                                <SelectValue placeholder={t("incidents.filters.allYear")} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">{t("incidents.filters.allYear")}</SelectItem>
                                {periods.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
                            <SelectTrigger className="w-[140px] bg-background touch-target" aria-label={t("incidents.filters.allSeverity")}>
                                <SelectValue placeholder={t("incidents.filters.allSeverity")} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">{t("incidents.filters.allSeverity")}</SelectItem>
                                <SelectItem value="CRITICAL">{t("incidents.severity.critical")}</SelectItem>
                                <SelectItem value="HIGH">{t("incidents.severity.high")}</SelectItem>
                                <SelectItem value="MEDIUM">{t("incidents.severity.medium")}</SelectItem>
                                <SelectItem value="LOW">{t("incidents.severity.low")}</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={selectedType} onValueChange={setSelectedType}>
                            <SelectTrigger className="w-[160px] bg-background touch-target" aria-label={t("incidents.filters.allTypes")}>
                                <SelectValue placeholder={t("incidents.filters.allTypes")} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">{t("incidents.filters.allTypes")}</SelectItem>
                                <SelectItem value="ABSENCE_UNEXCUSED">{t("incidents.types.ABSENCE_UNEXCUSED")}</SelectItem>
                                <SelectItem value="LATE">{t("incidents.types.LATE")}</SelectItem>
                                <SelectItem value="DISRESPECT">{t("incidents.types.DISRESPECT")}</SelectItem>
                                <SelectItem value="DISRUPTION">{t("incidents.types.DISRUPTION")}</SelectItem>
                                <SelectItem value="CHEATING">{t("incidents.types.CHEATING")}</SelectItem>
                                <SelectItem value="VIOLENCE">{t("incidents.types.VIOLENCE")}</SelectItem>
                                <SelectItem value="OTHER">{t("incidents.types.OTHER")}</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                            <SelectTrigger className="w-[140px] bg-background touch-target" aria-label={t("incidents.filters.allStatus")}>
                                <SelectValue placeholder={t("incidents.filters.allStatus")} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">{t("incidents.filters.allStatus")}</SelectItem>
                                <SelectItem value="UNRESOLVED">{t("incidents.filters.unresolved")}</SelectItem>
                                <SelectItem value="RESOLVED">{t("incidents.filters.resolved")}</SelectItem>
                            </SelectContent>
                        </Select>
                        {activeFiltersCount > 0 && (
                            <>
                                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                    {activeFiltersCount} {t("common.filters", { count: activeFiltersCount })}
                                </span>
                                <Button variant="ghost" size="sm" className="touch-target" onClick={resetFilters}>
                                    {t("common.reset")}
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {filteredIncidents.length === 0 ? (
                    <div className="p-6">
                        <PageCallout
                            icon={Shield}
                            title={t("incidents.emptyTitle")}
                            description={t("incidents.emptyDescription")}
                            actions={[{ label: t("incidents.actions.report"), href: "/dashboard/incidents/new" }]}
                        />
                    </div>
                ) : (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                        <DataTable columns={incidentColumns} data={filteredIncidents} />
                    </motion.div>
                )}
            </Card>
        </motion.div>
    );
}
