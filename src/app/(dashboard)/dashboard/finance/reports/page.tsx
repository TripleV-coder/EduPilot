"use client";

import { useEffect, useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { BarChart3, TrendingUp, TrendingDown, Calendar, FileText, Download, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaymentBarChart } from "@/components/charts/PaymentBarChart";
import { CategoryPieChart } from "@/components/charts/CategoryPieChart";
import { t } from "@/lib/i18n";

 

type FinanceStats = {
    totalRevenue: number;
    totalPending: number;
    collectionRate: number;
    revenueByMonth: { month: string; amount: number }[];
    revenueByCycle: { name: string; value: number }[];
    revenueGrowth: number;
    pendingGrowth: number;
};

export default function FinanceReportsPage() {
    const [period, setPeriod] = useState("academic");
    const [stats, setStats] = useState<FinanceStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetch(`/api/finance/stats?period=${period}`, { credentials: "include" })
            .then((r) => {
                if (!r.ok) throw new Error("Erreur de chargement des statistiques financières");
                return r.json();
            })
            .then((data) => {
                if (!cancelled) setStats(data);
            })
            .catch((e) => { if (!cancelled) setError(e.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [period]);

    const generateReport = async () => {
        setIsExporting(true);
        try {
            const res = await fetch(`/api/finance/reports/generate?period=${period}`, {
                method: "POST",
                credentials: "include",
            });
            if (!res.ok) throw new Error("Erreur de génération du rapport");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `rapport-finance-${period}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            setError("Erreur lors de la génération du rapport");
        } finally {
            setIsExporting(false);
        }
    };

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat("fr-BJ", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(amount);

    return (
        <PageGuard permission={[Permission.FINANCE_READ]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"]}>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <PageHeader
                        title="Rapports financiers"
                        description="Analyse des revenus et prévisions budgétaires"
                        breadcrumbs={[
                            { label: "Tableau de bord", href: "/dashboard" },
                            { label: "Finance", href: "/dashboard/finance" },
                            { label: "Rapports" },
                        ]}
                    />
                    <div className="flex items-center gap-3">
                        <Select value={period} onValueChange={setPeriod}>
                            <SelectTrigger className="w-[180px] bg-background">
                                <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="month">Ce mois</SelectItem>
                                <SelectItem value="quarter">Ce trimestre</SelectItem>
                                <SelectItem value="year">Cette année</SelectItem>
                                <SelectItem value="academic">Année académique</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button onClick={generateReport} disabled={isExporting} className="gap-2 shadow-sm">
                            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            {isExporting ? t("common.generating") : t("appActions.exportReport")}
                        </Button>
                    </div>
                </div>

                {error && (
                    <div role="alert" className="rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] px-4 py-3 text-sm text-destructive flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                {loading && (
                    <div className="flex justify-center items-center py-12">
                        <Loader2 className="animate-spin w-8 h-8 text-primary" />
                    </div>
                )}

                {!loading && stats && (
                    <>
                        {/* KPIs Section */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card className="border-border shadow-sm">
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-muted-foreground">Revenu total perçu</p>
                                            <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalRevenue)}</p>
                                        </div>
                                        <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                                            <TrendingUp className="w-5 h-5" />
                                        </div>
                                    </div>
                                    {stats.revenueGrowth != null && (
                                        <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
                                            <span className={`font-medium ${stats.revenueGrowth >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                                                {stats.revenueGrowth >= 0 ? "+" : ""}{stats.revenueGrowth.toFixed(1)}%
                                            </span> par rapport à la période précédente
                                        </p>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="border-border shadow-sm">
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-muted-foreground">Restant à percevoir</p>
                                            <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalPending)}</p>
                                        </div>
                                        <div className="p-2 bg-destructive/10 text-destructive rounded-lg">
                                            <TrendingDown className="w-5 h-5" />
                                        </div>
                                    </div>
                                    {stats.pendingGrowth != null && (
                                        <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
                                            <span className="text-destructive font-medium">{stats.pendingGrowth.toFixed(1)}%</span> de retard par rapport aux prévisions
                                        </p>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="border-border shadow-sm">
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-muted-foreground">Taux de recouvrement</p>
                                            <p className="text-2xl font-bold text-foreground">{stats.collectionRate.toFixed(1)}%</p>
                                        </div>
                                        <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                            <BarChart3 className="w-5 h-5" />
                                        </div>
                                    </div>
                                    <div className="mt-4 h-2 w-full bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary rounded-full"
                                            style={{ width: `${Math.max(0, Math.min(100, stats.collectionRate))}%` }}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Charts Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="border-border shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-lg">Évolution des revenus</CardTitle>
                                    <CardDescription>Encaissements par mois</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {stats.revenueByMonth && stats.revenueByMonth.length > 0 ? (
                                        <PaymentBarChart data={stats.revenueByMonth.map(m => ({ month: m.month, received: m.amount, pending: 0 }))} />
                                    ) : (
                                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                                            <p>Données insuffisantes pour le graphique</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="border-border shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-lg">Répartition par cycle</CardTitle>
                                    <CardDescription>Revenus par niveau académique</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {stats.revenueByCycle && stats.revenueByCycle.length > 0 ? (
                                        <CategoryPieChart data={stats.revenueByCycle} />
                                    ) : (
                                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                                            <p>Données insuffisantes pour le graphique</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </>
                )}
            </div>
        </PageGuard>
    );
}
