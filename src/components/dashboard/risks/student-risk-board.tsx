"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { AlertTriangle, ArrowUpDown, BookX, ShieldAlert, TrendingDown, UserX } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetcher } from "@/lib/fetcher";

type RiskMode = "dropout" | "failure";

type AnalyticsStudent = {
    studentId: string;
    studentName: string;
    averageGrade: number | null;
    attendanceRate: number | null;
    absenceCount: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
};

type StudentDirectoryItem = {
    id: string;
    enrollments?: Array<{
        class?: {
            id: string;
            name: string;
        } | null;
    }>;
};

type BehaviorIncidentItem = {
    studentId: string;
};

type RiskRow = {
    studentId: string;
    name: string;
    classId: string;
    className: string;
    averageGrade: number | null;
    attendanceRate: number | null;
    absenceCount: number;
    incidentsCount: number;
    score: number;
    status: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
};

type StudentRiskBoardProps = {
    mode: RiskMode;
    title: string;
    description: string;
    breadcrumbLabel: string;
};

function extractCollection<T>(payload: unknown, keys: string[]): T[] {
    if (Array.isArray(payload)) {
        return payload as T[];
    }

    if (payload && typeof payload === "object") {
        const record = payload as Record<string, unknown>;
        for (const key of keys) {
            const value = record[key];
            if (Array.isArray(value)) {
                return value as T[];
            }
        }
    }

    return [];
}

function toRiskStatus(score: number): RiskRow["status"] {
    if (score >= 80) return "CRITICAL";
    if (score >= 60) return "HIGH";
    if (score >= 40) return "MEDIUM";
    return "LOW";
}

function scoreWithRiskFloor(score: number, riskLevel: AnalyticsStudent["riskLevel"]): number {
    if (riskLevel === "CRITICAL") return Math.max(score, 85);
    if (riskLevel === "HIGH") return Math.max(score, 70);
    if (riskLevel === "MEDIUM") return Math.max(score, 45);
    return score;
}

function computeRiskScore(mode: RiskMode, analytics: AnalyticsStudent, incidentsCount: number): number {
    const attendance = analytics.attendanceRate ?? 100;
    const average = analytics.averageGrade ?? 20;
    const absences = analytics.absenceCount ?? 0;

    const rawScore = mode === "dropout"
        ? ((100 - attendance) * 0.55) + (absences * 5) + (incidentsCount * 8)
        : ((20 - average) * 5) + ((100 - attendance) * 0.2) + (incidentsCount * 4);

    const boundedScore = Math.max(0, Math.min(100, Math.round(rawScore)));
    return scoreWithRiskFloor(boundedScore, analytics.riskLevel);
}

function statusTone(status: RiskRow["status"]): string {
    if (status === "CRITICAL") return "bg-[#C0392B]/10 text-[#C0392B] border-[#C0392B]/20";
    if (status === "HIGH") return "bg-[#D4830F]/10 text-[#D4830F] border-[#D4830F]/20";
    if (status === "MEDIUM") return "bg-[#2E6DA4]/10 text-[#2E6DA4] border-[#2E6DA4]/20";
    return "bg-[#2D6A4F]/10 text-[#2D6A4F] border-[#2D6A4F]/20";
}

export function StudentRiskBoard({ mode, title, description, breadcrumbLabel }: StudentRiskBoardProps) {
    const [classFilter, setClassFilter] = useState<string>("ALL");

    const { data: analyticsPayload, isLoading: analyticsLoading } = useSWR<AnalyticsStudent[]>(
        "/api/analytics/students?latestOnly=true&limit=200",
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 30000 }
    );
    const { data: studentsPayload, isLoading: studentsLoading } = useSWR<unknown>(
        "/api/students?limit=200",
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 30000 }
    );
    const { data: incidentsPayload, isLoading: incidentsLoading } = useSWR<{ incidents?: BehaviorIncidentItem[] }>(
        "/api/incidents?limit=200",
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 30000 }
    );

    const analytics = Array.isArray(analyticsPayload) ? analyticsPayload : [];
    const students = extractCollection<StudentDirectoryItem>(studentsPayload, ["students", "data"]);
    const incidents = extractCollection<BehaviorIncidentItem>(incidentsPayload, ["incidents"]);

    const allRows = useMemo<RiskRow[]>(() => {
        const incidentsByStudent = incidents.reduce<Record<string, number>>((accumulator, incident) => {
            accumulator[incident.studentId] = (accumulator[incident.studentId] || 0) + 1;
            return accumulator;
        }, {});

        const studentsById = new Map<string, StudentDirectoryItem>(
            students.map((student) => [student.id, student])
        );

        return analytics
            .map((entry) => {
                const studentDirectory = studentsById.get(entry.studentId);
                const firstEnrollment = studentDirectory?.enrollments?.[0];
                const classId = firstEnrollment?.class?.id ?? "UNASSIGNED";
                const className = firstEnrollment?.class?.name ?? "Non assignée";
                const incidentsCount = incidentsByStudent[entry.studentId] || 0;
                const score = computeRiskScore(mode, entry, incidentsCount);

                return {
                    studentId: entry.studentId,
                    name: entry.studentName,
                    classId,
                    className,
                    averageGrade: entry.averageGrade,
                    attendanceRate: entry.attendanceRate,
                    absenceCount: entry.absenceCount,
                    incidentsCount,
                    score,
                    status: toRiskStatus(score),
                };
            })
            .sort((left, right) => right.score - left.score);
    }, [analytics, incidents, mode, students]);

    const rows = useMemo(
        () => allRows.filter((row) => classFilter === "ALL" || row.classId === classFilter),
        [allRows, classFilter]
    );

    const classes = useMemo(
        () =>
            Array.from(
                new Map(
                    allRows
                        .filter((row) => row.classId !== "UNASSIGNED")
                        .map((row) => [row.classId, row.className])
                )
            )
                .map(([id, name]) => ({ id, name }))
                .sort((left, right) => left.name.localeCompare(right.name, "fr")),
        [allRows]
    );

    const highRiskCount = rows.filter((row) => row.score >= 60).length;
    const criticalCount = rows.filter((row) => row.score >= 80).length;
    const averageAttendance = rows.length > 0
        ? Math.round(rows.reduce((sum, row) => sum + (row.attendanceRate ?? 0), 0) / rows.length)
        : 0;
    const averageGrade = rows.length > 0
        ? Number((rows.reduce((sum, row) => sum + (row.averageGrade ?? 0), 0) / rows.length).toFixed(1))
        : 0;

    const columns = useMemo<ColumnDef<RiskRow>[]>(
        () => [
            {
                accessorKey: "name",
                header: ({ column }) => (
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                        Élève
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                ),
                cell: ({ row }) => <span className="font-semibold text-foreground">{row.original.name}</span>,
            },
            {
                accessorKey: "className",
                header: "Classe",
                cell: ({ row }) => <span className="text-muted-foreground">{row.original.className}</span>,
            },
            {
                accessorKey: "attendanceRate",
                header: "Présence",
                cell: ({ row }) => (
                    <span className="font-medium">{row.original.attendanceRate == null ? "—" : `${Math.round(row.original.attendanceRate)}%`}</span>
                ),
            },
            {
                accessorKey: "averageGrade",
                header: "Moyenne",
                cell: ({ row }) => (
                    <span className="font-medium">{row.original.averageGrade == null ? "—" : `${row.original.averageGrade.toFixed(1)}/20`}</span>
                ),
            },
            {
                accessorKey: "incidentsCount",
                header: "Incidents",
                cell: ({ row }) => <span>{row.original.incidentsCount}</span>,
            },
            {
                accessorKey: "score",
                header: ({ column }) => (
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                        Score
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                ),
                cell: ({ row }) => (
                    <div className="flex items-center gap-2">
                        <span className="font-semibold">{row.original.score}</span>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusTone(row.original.status)}`}>
                            {row.original.status}
                        </span>
                    </div>
                ),
            },
            {
                id: "actions",
                header: "Détail",
                cell: ({ row }) => (
                    <Button asChild size="sm" variant="ghost" className="justify-start px-0">
                        <Link href={`/dashboard/students/${row.original.studentId}`}>Fiche élève</Link>
                    </Button>
                ),
            },
        ],
        []
    );

    const loading = analyticsLoading || studentsLoading || incidentsLoading;
    const leadingMetric = mode === "dropout"
        ? { title: "Assiduité moyenne", value: `${averageAttendance}%`, icon: UserX }
        : { title: "Moyenne moyenne", value: `${averageGrade}/20`, icon: BookX };

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <PageHeader
                    title={title}
                    description={description}
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Alertes & Risques" },
                        { label: breadcrumbLabel },
                    ]}
                />
                <div className="flex items-center gap-2">
                    <Select value={classFilter} onValueChange={setClassFilter}>
                        <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Toutes les classes" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Toutes les classes</SelectItem>
                            {classes.map((classItem) => (
                                <SelectItem key={classItem.id} value={classItem.id}>
                                    {classItem.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => setClassFilter("ALL")}>
                        Réinitialiser
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>Élèves sous surveillance</CardDescription>
                        <CardTitle className="flex items-center justify-between text-2xl">
                            {highRiskCount}
                            <ShieldAlert className="h-5 w-5 text-[#C0392B]" />
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>Élèves critiques</CardDescription>
                        <CardTitle className="flex items-center justify-between text-2xl">
                            {criticalCount}
                            <AlertTriangle className="h-5 w-5 text-[#D4830F]" />
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>{leadingMetric.title}</CardDescription>
                        <CardTitle className="flex items-center justify-between text-2xl">
                            {leadingMetric.value}
                            <leadingMetric.icon className="h-5 w-5 text-[#2D6A4F]" />
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>Classes touchées</CardDescription>
                        <CardTitle className="flex items-center justify-between text-2xl">
                            {new Set(rows.map((row) => row.classId)).size}
                            <TrendingDown className="h-5 w-5 text-[#2E6DA4]" />
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{mode === "dropout" ? "Signal décrochage" : "Signal échec scolaire"}</CardTitle>
                    <CardDescription>
                        Classement temps réel basé sur les analytics élèves, les absences et les incidents enregistrés.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="grid gap-3">
                            {[0, 1, 2, 3].map((item) => (
                                <div key={item} className="h-14 animate-pulse rounded-xl bg-muted/60" />
                            ))}
                        </div>
                    ) : (
                        <DataTable
                            columns={columns}
                            data={rows}
                            searchKey="name"
                            searchPlaceholder="Rechercher un élève..."
                            pageSizeOptions={[25, 50, 100]}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
