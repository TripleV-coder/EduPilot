"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
    BarChart3, ArrowLeft, TrendingUp, Users, 
    GraduationCap, BookOpen, User, Calendar
} from "lucide-react";
import Link from "next/link";
import { InteractivePerformanceBarChart } from "@/components/charts/InteractivePerformanceBarChart";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";

export default function SubjectAnalyticsPage() {
    const params = useParams();
    const classId = params.classId as string;
    const subjectId = params.subjectId as string;

    const { data: subjectData, isLoading, error } = useSWR(
        classId && subjectId ? `/api/analytics/class/${classId}/subject/${subjectId}` : null,
        fetcher
    );

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: "studentName",
            header: "Élève",
            cell: ({ row }) => <span className="font-bold">{row.original.studentName}</span>
        },
        {
            accessorKey: "average",
            header: "Moyenne",
            cell: ({ row }) => (
                <span className={`font-black ${Number(row.original.average) >= 10 ? 'text-primary' : 'text-destructive'}`}>
                    {Number(row.original.average).toFixed(2)}/20
                </span>
            )
        },
        {
            accessorKey: "rank",
            header: "Rang",
            cell: ({ row }) => <Badge variant="outline" className="font-bold">#{row.original.rank}</Badge>
        }
    ];

    if (error) return <div className="p-8 text-destructive">Erreur de chargement des données analytiques.</div>;

    return (
        <PageGuard permission={Permission.ANALYTICS_VIEW}>
            <div className="space-y-6 pb-24">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/analytics">
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <PageHeader
                        title={subjectData?.subjectName || "Chargement..."}
                        description={`Analyse détaillée de la matière pour la classe ${subjectData?.className || ""}`}
                        breadcrumbs={[
                            { label: "Analytics", href: "/dashboard/analytics" },
                            { label: "Détail Matière" },
                        ]}
                    />
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-24"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>
                ) : (
                    <>
                        {/* KPI Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card className="dashboard-block kpi-card border-border bg-card">
                                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Moyenne Matière</div>
                                    <GraduationCap className="w-3.5 h-3.5 text-primary/50" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl metric-serif text-primary">{subjectData.average?.toFixed(2)}/20</div>
                                </CardContent>
                            </Card>
                            <Card className="dashboard-block kpi-card border-border bg-card">
                                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Plus haute / basse</div>
                                    <TrendingUp className="w-3.5 h-3.5 text-success/50" />
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl metric-serif text-success">{subjectData.highest?.toFixed(1)}</span>
                                        <span className="text-muted-foreground text-xs">/</span>
                                        <span className="text-2xl metric-serif text-destructive">{subjectData.lowest?.toFixed(1)}</span>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="dashboard-block kpi-card border-border bg-card">
                                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Médiane</div>
                                    <BarChart3 className="w-3.5 h-3.5 text-primary/50" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl metric-serif">{subjectData.median?.toFixed(2)}</div>
                                </CardContent>
                            </Card>
                            <Card className="dashboard-block kpi-card border-border bg-card">
                                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Taux de réussite</div>
                                    <Users className="w-3.5 h-3.5 text-warning/50" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl metric-serif text-warning">
                                        {((subjectData.studentGrades.filter((s: any) => s.average >= 10).length / subjectData.studentGrades.length) * 100).toFixed(1)}%
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
                            {/* Grade Distribution */}
                            <Card className="lg:col-span-6 border-border">
                                <CardHeader>
                                    <CardTitle className="text-sm font-bold uppercase tracking-widest">Distribution des Notes</CardTitle>
                                    <CardDescription className="text-[10px]">Répartition des élèves par tranche de performance.</CardDescription>
                                </CardHeader>
                                <CardContent className="h-[350px]">
                                    <InteractivePerformanceBarChart data={subjectData.gradeDistribution || []} />
                                </CardContent>
                            </Card>

                            {/* Monthly Trend */}
                            <Card className="lg:col-span-4 border-border">
                                <CardHeader>
                                    <CardTitle className="text-sm font-bold uppercase tracking-widest">Évolution de la Moyenne</CardTitle>
                                    <CardDescription className="text-[10px]">Tendance mensuelle sur l&apos;année en cours.</CardDescription>
                                </CardHeader>
                                <CardContent className="h-[350px]">
                                    <TrendLineChart data={subjectData.monthlyTrend || []} />
                                </CardContent>
                            </Card>
                        </div>

                        {/* Student Ranking Table */}
                        <Card className="border-border overflow-hidden">
                            <CardHeader className="bg-muted/30 border-b">
                                <CardTitle className="text-sm font-bold uppercase tracking-widest">Classement Individuel</CardTitle>
                                <CardDescription className="text-[10px]">Performance nominative des élèves dans cette matière.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <DataTable 
                                    columns={columns} 
                                    data={subjectData.studentGrades || []} 
                                    searchKey="studentName"
                                    searchPlaceholder="Rechercher un élève..."
                                />
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </PageGuard>
    );
}
