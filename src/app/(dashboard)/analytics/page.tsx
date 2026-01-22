"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Users, GraduationCap, ArrowUpRight, ArrowDownRight, Activity, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useQuery } from "@tanstack/react-query";


export default function AnalyticsPage() {
    const { data, isLoading, error } = useQuery({
        queryKey: ["analytics-overview"],
        queryFn: async () => {
            const res = await fetch("/api/analytics/school/overview");
            if (!res.ok) throw new Error("Erreur chargement analytics");
            return res.json();
        }
    });

    if (isLoading) return <div className="flex justify-center items-center h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    if (error) return <div className="p-4 text-destructive bg-destructive/10 rounded-lg">Erreur: Impossible de charger les données analytiques.</div>;

    // Mapping API data to Chart formats
    const performanceData = Object.values(data?.subjectSummary || []).map((s: any) => ({
        name: s.name.substring(0, 15), // Truncate long names
        moyenne: Number(s.average).toFixed(1),
        count: s.studentsCount
    })).slice(0, 10); // Top 10 subjects

    const riskData = [
        { name: 'Critique', value: data?.riskDistribution?.critical || 0, color: '#ef4444' },
        { name: 'Élevé', value: data?.riskDistribution?.high || 0, color: '#f97316' },
        { name: 'Moyen', value: data?.riskDistribution?.medium || 0, color: '#eab308' },
        { name: 'Faible', value: data?.riskDistribution?.low || 0, color: '#22c55e' },
    ].filter(d => d.value > 0);

    const periodComparison = data?.periodComparison;

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Tableau de Bord Analytique</h1>
                    <p className="text-muted-foreground">Données temps réel de l&apos;établissement.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select defaultValue="current">
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Période" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="current">Année Courante</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card variant="glass">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Moyenne Générale</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.overview?.averageGrade || 0}/20</div>
                        {periodComparison && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                {periodComparison.improvement >= 0 ? <ArrowUpRight className="h-3 w-3 text-green-500" /> : <ArrowDownRight className="h-3 w-3 text-red-500" />}
                                {Number(periodComparison.improvement).toFixed(2)} pts vs {periodComparison.previousPeriod}
                            </p>
                        )}
                    </CardContent>
                </Card>
                <Card variant="glass">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Élèves Actifs</CardTitle>
                        <Activity className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.overview?.activeStudents || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Sur {data?.overview?.totalStudents} inscrits
                        </p>
                    </CardContent>
                </Card>
                <Card variant="glass">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Performance</CardTitle>
                        <GraduationCap className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.performanceDistribution?.excellent || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Élèves niveau &quot;Excellent&quot;
                        </p>
                    </CardContent>
                </Card>
                <Card variant="glass">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">À Risque</CardTitle>
                        <Users className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.riskDistribution?.critical || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1 text-red-500">
                            Niveau critique détecté
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Subject Performance Chart */}
                <Card className="col-span-4" variant="glass">
                    <CardHeader>
                        <CardTitle>Moyennes par Matière</CardTitle>
                        <CardDescription>Performance globale (Top 10).</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[300px] w-full">
                            {performanceData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={performanceData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground)/0.2)" />
                                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                                        <YAxis stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} domain={[0, 20]} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                            cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
                                        />
                                        <Bar dataKey="moyenne" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex h-full items-center justify-center text-muted-foreground">Pas assez de données</div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Risk Distribution Chart */}
                <Card className="col-span-3" variant="glass">
                    <CardHeader>
                        <CardTitle>Analyse des Risques</CardTitle>
                        <CardDescription>Répartition par niveau d&apos;alerte</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            {riskData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={riskData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {riskData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderRadius: '8px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex h-full items-center justify-center text-muted-foreground">Aucun risque détecté (ou pas de données)</div>
                            )}
                            <div className="flex justify-center gap-4 mt-4 flex-wrap">
                                {riskData.map((item, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-sm font-medium">{item.name} ({item.value})</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
