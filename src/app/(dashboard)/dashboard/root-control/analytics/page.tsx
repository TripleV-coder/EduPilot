"use client";

import { useEffect, useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Users, CreditCard, TrendingUp, Activity, Loader2, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaymentBarChart } from "@/components/charts/PaymentBarChart";
import { TrendLineChart } from "@/components/charts/TrendLineChart";

type RootAnalyticsData = {
    period: string;
    summary: {
        users: number;
        revenue: number;
        schools: number;
        activity: number;
    };
    timeline: {
        date: string;
        users: number;
        revenue: number;
        schools: number;
        activity: number;
    }[];
};

export default function RootAnalyticsPage() {
    const [period, setPeriod] = useState("30d");
    const [data, setData] = useState<RootAnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        queueMicrotask(() => {
            if (!cancelled) setLoading(true);
        });
        fetch(`/api/root/analytics?period=${period}`, { credentials: "include" })
            .then((res) => {
                if (!res.ok) throw new Error("Erreur de chargement des statistiques SaaS");
                return res.json();
            })
            .then((resData) => {
                if (!cancelled) setData(resData);
            })
            .catch((err) => {
                if (!cancelled) setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [period]);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat("fr-BJ", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(amount);

    return (
        <PageGuard roles={["SUPER_ADMIN"]}>
            <div className="space-y-6 max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <PageHeader
                        title="Root Analytics"
                        description="Vue globale (SaaS) des performances et de l'utilisation de la plateforme EduPilot"
                        breadcrumbs={[
                            { label: "Tableau de bord", href: "/dashboard" },
                            { label: "Root Control", href: "/dashboard/root-control" },
                            { label: "Analytics" },
                        ]}
                    />
                    <div className="flex items-center gap-3">
                        <Select value={period} onValueChange={setPeriod}>
                            <SelectTrigger className="w-[150px] bg-background">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="7d">7 derniers jours</SelectItem>
                                <SelectItem value="30d">30 derniers jours</SelectItem>
                                <SelectItem value="90d">Ce trimestre</SelectItem>
                                <SelectItem value="1y">Cette année</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {error && (
                    <div role="alert" className="rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] px-4 py-3 text-sm text-destructive flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 className="animate-spin w-8 h-8 text-primary" />
                    </div>
                ) : data ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <Card className="border-border shadow-sm">
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-muted-foreground">Établissements Actifs</p>
                                            <p className="text-3xl font-bold text-foreground">{data.summary.schools}</p>
                                        </div>
                                        <div className="p-3 bg-primary/10 text-primary rounded-xl">
                                            <Building2 className="w-6 h-6" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-border shadow-sm">
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-muted-foreground">Utilisateurs Globaux</p>
                                            <p className="text-3xl font-bold text-foreground">{data.summary.users}</p>
                                        </div>
                                        <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
                                            <Users className="w-6 h-6" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-border shadow-sm">
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-muted-foreground">Revenus Période</p>
                                            <p className="text-3xl font-bold text-foreground">{formatCurrency(data.summary.revenue)}</p>
                                        </div>
                                        <div className="p-3 bg-green-500/10 text-green-600 rounded-xl">
                                            <CreditCard className="w-6 h-6" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-border shadow-sm">
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-muted-foreground">Événements Audit Période</p>
                                            <p className="text-3xl font-bold text-foreground">{data.summary.activity}</p>
                                        </div>
                                        <div className="p-3 bg-orange-500/10 text-orange-600 rounded-xl">
                                            <Activity className="w-6 h-6" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                            <Card className="border-border shadow-sm min-h-[350px]">
                                <CardHeader className="border-b border-border/50">
                                    <CardTitle>Chiffre d'affaires</CardTitle>
                                    <CardDescription>Évolution des entrées finançières de la plateforme.</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    {data.timeline.length > 0 ? (
                                        <PaymentBarChart data={data.timeline.map(t => ({ month: t.date, received: t.revenue, pending: 0 }))} />
                                    ) : (
                                        <div className="h-[250px] flex items-center justify-center text-muted-foreground">Aucune donnée</div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="border-border shadow-sm min-h-[350px]">
                                <CardHeader className="border-b border-border/50">
                                    <CardTitle>Activité Utilisateurs</CardTitle>
                                    <CardDescription>Tendance des inscriptions par date.</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    {data.timeline.length > 0 ? (
                                        <TrendLineChart
                                            data={data.timeline.map(t => ({ name: t.date, value: t.users }))}
                                            label="Nouveaux utilisateurs"
                                            color="hsl(var(--primary))"
                                        />
                                    ) : (
                                        <div className="h-[250px] flex items-center justify-center text-muted-foreground">Aucune donnée</div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </>
                ) : null}
            </div>
        </PageGuard>
    );
}
