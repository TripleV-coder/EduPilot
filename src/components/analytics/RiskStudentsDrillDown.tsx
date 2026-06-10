"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetcher } from "@/lib/fetcher";

const RISK_LABELS: Record<string, string> = {
    LOW: "Faible",
    MEDIUM: "Moyen",
    HIGH: "Élevé",
    CRITICAL: "Critique",
};

const RISK_BADGE_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    LOW: "secondary",
    MEDIUM: "outline",
    HIGH: "destructive",
    CRITICAL: "destructive",
};

interface RiskStudentRow {
    studentId: string;
    studentName: string;
    averageGrade: number | null;
    attendanceRate: number | null;
    riskLevel: string;
}

interface RiskStudentsDrillDownProps {
    riskLevel: string;
    academicYearId?: string;
    periodId?: string;
}

export function RiskStudentsDrillDown({ riskLevel, academicYearId, periodId }: RiskStudentsDrillDownProps) {
    const params = new URLSearchParams({ riskLevel, limit: "50" });
    if (academicYearId) params.set("academicYearId", academicYearId);
    if (periodId) params.set("periodId", periodId);

    const { data, error, isLoading } = useSWR<RiskStudentRow[]>(
        `/api/analytics/students?${params.toString()}`,
        fetcher,
        { revalidateOnFocus: false },
    );

    const students = Array.isArray(data) ? data : [];

    return (
        <Card className="border-border bg-card">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    Élèves à risque « {RISK_LABELS[riskLevel] ?? riskLevel} »
                    <Badge variant={RISK_BADGE_VARIANTS[riskLevel] ?? "outline"} className="text-[10px]">
                        {students.length}
                    </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                    Cliquez sur un élève pour ouvrir sa fiche détaillée
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
                        ))}
                    </div>
                ) : error ? (
                    <div className="flex items-center gap-2 text-sm text-destructive py-4">
                        <AlertCircle className="h-4 w-4" />
                        Impossible de charger la liste des élèves. Réessayez dans quelques instants.
                    </div>
                ) : students.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                        Aucun élève à ce niveau de risque sur la période sélectionnée.
                    </p>
                ) : (
                    <ul className="divide-y divide-border">
                        {students.map((s) => (
                            <li key={s.studentId}>
                                <Link
                                    href={`/dashboard/students/${s.studentId}`}
                                    className="flex items-center justify-between gap-3 py-2.5 px-1 rounded-md hover:bg-muted/60 transition-colors group"
                                >
                                    <span className="text-sm font-medium truncate">{s.studentName}</span>
                                    <span className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                                        <span className="tabular-nums">
                                            Moy. {s.averageGrade !== null ? `${Number(s.averageGrade).toFixed(2)}/20` : "—"}
                                        </span>
                                        <span className="tabular-nums">
                                            Assiduité {s.attendanceRate !== null ? `${s.attendanceRate}%` : "—"}
                                        </span>
                                        <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
