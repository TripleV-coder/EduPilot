"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InteractiveSubjectRadarChart } from "@/components/charts/InteractiveSubjectRadarChart";
import { InteractivePerformanceBarChart } from "@/components/charts/InteractivePerformanceBarChart";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { PerformanceBarChart } from "@/components/charts/PerformanceBarChart";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { 
    GraduationCap, BookOpen, TrendingUp, Users, 
    ArrowRight, ScatterChart as ScatterIcon, User
} from "lucide-react";
import { 
    ScatterChart, Scatter, XAxis, YAxis, ZAxis, 
    CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from "recharts";
import { FR_TOOLTIP_STYLE } from "@/components/charts/chart-theme";

interface AcademicPerformancesTabProps {
    classes: any[];
    academicYearId: string;
}

export function AcademicPerformancesTab({ classes, academicYearId }: AcademicPerformancesTabProps) {
    const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || "");
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");

    const { data: classData, isLoading: classLoading } = useSWR(
        selectedClassId ? `/api/analytics/class/${selectedClassId}` : null,
        fetcher
    );

    const { data: subjectData, isLoading: subjectLoading } = useSWR(
        selectedClassId && selectedSubjectId
            ? `/api/analytics/class/${selectedClassId}/subject/${selectedSubjectId}`
            : null,
        fetcher
    );

    // Columns for progression table
    const columns: ColumnDef<any>[] = [
        {
            accessorKey: "name",
            header: "Élève",
            cell: ({ row }) => <span className="font-bold">{row.original.name}</span>
        },
        {
            accessorKey: "average",
            header: "Moyenne",
            cell: ({ row }) => <span className="font-black text-primary">{row.original.average}/20</span>
        },
        {
            id: "rank",
            header: "Rang",
            cell: ({ row }) => <Badge variant="outline" className="font-bold">#{row.original.rank}</Badge>
        },
        {
            id: "action",
            header: "",
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            )
        }
    ];

    // Mock Value Added Data
    const scatterData = useMemo(() => {
        if (!classData?.studentRanking) return [];
        return classData.studentRanking.map((s: any) => ({
            name: s.name,
            x: 8 + Math.random() * 8, // Initial level mock
            y: -2 + Math.random() * 6, // Added value mock
            average: s.average
        }));
    }, [classData]);

    return (
        <div className="space-y-6">
            {/* Header & Class Selector */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-card border border-border p-4 rounded-xl shadow-sm" data-reveal>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <GraduationCap className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-tight">Performances par Classe</h3>
                        <p className="text-[10px] text-muted-foreground font-medium">Analysez les résultats et la progression académique.</p>
                    </div>
                </div>
                <Select value={selectedClassId} onValueChange={(v) => { setSelectedClassId(v); setSelectedSubjectId(""); }}>
                    <SelectTrigger className="w-[240px] h-10 font-bold">
                        <SelectValue placeholder="Choisir une classe" />
                    </SelectTrigger>
                    <SelectContent>
                        {classes.map(c => <SelectItem key={c.id} value={c.id} className="font-medium">{c.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {/* Radar & Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
                <Card className="lg:col-span-6 dashboard-block border-border" data-reveal>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <div>
                            <CardTitle className="text-sm font-bold uppercase tracking-tight">Radar des Matières</CardTitle>
                            <CardDescription className="text-[10px]">Profil de performance équilibré vs déséquilibré</CardDescription>
                        </div>
                        <BookOpen className="w-4 h-4 text-muted-foreground/50" />
                    </CardHeader>
                    <CardContent className="h-[400px] pt-6">
                        <InteractiveSubjectRadarChart 
                            data={classData?.subjectSummary || []} 
                            onSubjectClick={(id) => setSelectedSubjectId(id)}
                            filterSubjectId={selectedSubjectId}
                        />
                    </CardContent>
                </Card>

                <Card className="lg:col-span-4 dashboard-block border-border" data-reveal>
                    <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase tracking-tight">Progression Individuelle</CardTitle>
                        <CardDescription className="text-[10px]">Top 10 des élèves par moyenne générale</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <DataTable 
                            columns={columns} 
                            data={classData?.studentRanking?.slice(0, 10) || []} 
                            searchKey="name"
                            searchPlaceholder="Chercher..."
                        />
                    </CardContent>
                </Card>
            </div>

            {/* Subject Drill-down 2x2 Grid */}
            {selectedSubjectId && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-border" />
                        <Badge variant="secondary" className="px-4 py-1 text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary border-primary/20">
                            Focus Matière : {classData?.subjectSummary?.find((s:any) => s.subjectId === selectedSubjectId)?.name}
                        </Badge>
                        <div className="h-px flex-1 bg-border" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="dashboard-block border-border h-[300px]">
                            <CardHeader className="pb-2"><CardTitle className="text-[11px] uppercase font-black text-muted-foreground">Évolution de la Moyenne</CardTitle></CardHeader>
                            <CardContent className="h-[220px]">
                                <TrendLineChart data={subjectData?.monthlyTrend || []} />
                            </CardContent>
                        </Card>
                        <Card className="dashboard-block border-border h-[300px]">
                            <CardHeader className="pb-2"><CardTitle className="text-[11px] uppercase font-black text-muted-foreground">Distribution des Notes</CardTitle></CardHeader>
                            <CardContent className="h-[220px]">
                                <PerformanceBarChart data={subjectData?.gradeDistribution || []} />
                            </CardContent>
                        </Card>
                        <Card className="dashboard-block border-border h-[300px]">
                            <CardHeader className="pb-2"><CardTitle className="text-[11px] uppercase font-black text-muted-foreground">Classement vs Établissement</CardTitle></CardHeader>
                            <CardContent className="flex flex-col items-center justify-center h-[220px] text-center">
                                <TrendingUp className="w-12 h-12 text-primary/20 mb-4" />
                                <div className="text-4xl metric-serif italic">#2</div>
                                <p className="text-xs font-bold text-muted-foreground uppercase mt-2">Sur 8 classes du même niveau</p>
                            </CardContent>
                        </Card>
                        <Card className="dashboard-block border-border h-[300px]">
                            <CardHeader className="pb-2"><CardTitle className="text-[11px] uppercase font-black text-muted-foreground">Enseignant Référent</CardTitle></CardHeader>
                            <CardContent className="flex flex-col items-center justify-center h-[220px] text-center">
                                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 border-2 border-primary/20">
                                    <User className="w-8 h-8 text-primary/40" />
                                </div>
                                <div className="font-bold text-sm">M. Jean-Luc DUPONT</div>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Agrégé en Mathématiques</p>
                                <Badge variant="outline" className="mt-4 text-[9px] font-bold">Voir profil complet</Badge>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* Value Added Scatter Plot */}
            <Card className="dashboard-block border-border" data-reveal>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-sm font-bold uppercase tracking-tight">Analyse de la Valeur Ajoutée</CardTitle>
                            <CardDescription className="text-[10px]">Niveau initial vs Progression réalisée (Quadrants)</CardDescription>
                        </div>
                        <ScatterIcon className="w-4 h-4 text-muted-foreground/50" />
                    </div>
                </CardHeader>
                <CardContent className="h-[400px] pt-6">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis type="number" dataKey="x" name="Niveau Initial" unit="/20" domain={[0, 20]} tick={{ fontSize: 10 }} />
                            <YAxis type="number" dataKey="y" name="Valeur Ajoutée" unit="pts" domain={[-5, 5]} tick={{ fontSize: 10 }} />
                            <ZAxis type="number" dataKey="average" range={[50, 400]} />
                            <Tooltip contentStyle={FR_TOOLTIP_STYLE as React.CSSProperties} cursor={{ strokeDasharray: '3 3' }} />
                            <Scatter name="Élèves" data={scatterData}>
                                {scatterData.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={entry.y >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"} />
                                ))}
                            </Scatter>
                            {/* Quadrant labels */}
                            <text x="75%" y="25%" textAnchor="middle" fill="hsl(var(--primary))" fontSize="10" fontWeight="bold" opacity={0.4}>EXCELLENCE</text>
                            <text x="25%" y="25%" textAnchor="middle" fill="hsl(var(--primary))" fontSize="10" fontWeight="bold" opacity={0.4}>FORTE PROGRESSION</text>
                            <text x="25%" y="75%" textAnchor="middle" fill="hsl(var(--destructive))" fontSize="10" fontWeight="bold" opacity={0.4}>ALERTE DÉCROCHAGE</text>
                            <text x="75%" y="75%" textAnchor="middle" fill="hsl(var(--warning))" fontSize="10" fontWeight="bold" opacity={0.4}>SOUS-PERFORMANCE</text>
                        </ScatterChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
