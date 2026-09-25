"use client";

import useSWR from "swr";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-shell";
import { PageEmpty, PageError } from "@/components/layout/page-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, PieChart, Wallet, Receipt, ShieldCheck } from "lucide-react";
import { fetcher } from "@/lib/fetcher";

type RootFinanceSummary = {
    summary: {
        totalMonthlyRevenue: number;
        activeTenants: number;
        averageRevenuePerTenant: number;
        collectionRate: number;
    };
    distribution: { name: string; count: number }[];
    recentPayments: { id: string; schoolName: string; amount: number; paidAt: string | null }[];
};

const fcfa = (value: number) => Math.round(value).toLocaleString("fr-FR");

function KpiSkeleton() {
    return (
        <Card>
            <CardContent className="p-6 space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-9 w-40" />
                <Skeleton className="h-4 w-44" />
            </CardContent>
        </Card>
    );
}

export default function RootFinancePage() {
    const { data, error, isLoading, mutate } = useSWR<RootFinanceSummary>("/api/root/finance/summary", fetcher);

    const summary = data?.summary;
    const distribution = data?.distribution ?? [];
    const recentPayments = data?.recentPayments ?? [];
    const distributionTotal = distribution.reduce((sum, item) => sum + item.count, 0);

    return (
        <PageGuard roles={["SUPER_ADMIN"]}>
            <div className="space-y-4">
                <PageHeader
                    title="Finances Plateforme"
                    description="Suivi du chiffre d'affaires récurrent et de la performance commerciale globale."
                />

                {/* Sans ce cas, une panne affichait 0 F CFA de chiffre
                    d'affaires et 0 établissement actif : un écran de crise
                    parfaitement lisible, et parfaitement faux. */}
                {error ? (
                    <PageError
                        message="Impossible de charger les chiffres de la plateforme."
                        onRetry={() => void mutate()}
                    />
                ) : null}

                {/* Pendant le chargement, des squelettes plutôt que des zéros :
                    un « 0 FCFA » transitoire se lit comme un vrai chiffre. */}
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6" aria-busy="true" aria-label="Chargement des indicateurs">
                        <KpiSkeleton />
                        <KpiSkeleton />
                        <KpiSkeleton />
                    </div>
                ) : summary ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card>
                            <CardContent className="p-6 space-y-2">
                                <p className="text-sm font-medium text-muted-foreground">Chiffre d&apos;affaires mensuel (MRR)</p>
                                <p className="text-3xl font-bold tabular-nums text-foreground">
                                    {fcfa(summary.totalMonthlyRevenue)} <span className="text-lg font-semibold">FCFA</span>
                                </p>
                                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <Wallet className="w-4 h-4" aria-hidden="true" />
                                    Somme des abonnements mensuels actifs
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6 space-y-2">
                                <p className="text-sm font-medium text-muted-foreground">Revenu moyen par école (ARPU)</p>
                                <p className="text-3xl font-bold tabular-nums text-foreground">
                                    {fcfa(summary.averageRevenuePerTenant)} <span className="text-lg font-semibold">FCFA</span>
                                </p>
                                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <Building2 className="w-4 h-4" aria-hidden="true" />
                                    Sur {summary.activeTenants} établissement{summary.activeTenants > 1 ? "s" : ""} actif{summary.activeTenants > 1 ? "s" : ""}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6 space-y-2">
                                <p className="text-sm font-medium text-muted-foreground">Taux de recouvrement</p>
                                <p className="text-3xl font-bold tabular-nums text-foreground">
                                    {summary.collectionRate.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
                                </p>
                                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                                    Basé sur les paiements validés
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                ) : null}

                {!error ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Distribution par plan */}
                        <Card>
                            <CardHeader className="border-b border-border/50">
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    <PieChart className="w-4 h-4 text-primary" aria-hidden="true" />
                                    Répartition des abonnements
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                {isLoading ? (
                                    <div className="space-y-4">
                                        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
                                    </div>
                                ) : distribution.length === 0 || distributionTotal === 0 ? (
                                    <PageEmpty
                                        icon="cards"
                                        title="Aucun abonnement actif"
                                        description="La répartition apparaîtra dès qu'une école aura un plan actif."
                                        className="min-h-[180px]"
                                    />
                                ) : (
                                    <ul className="space-y-4">
                                        {distribution.map((item) => {
                                            const share = (item.count / distributionTotal) * 100;
                                            return (
                                                <li key={item.name} className="space-y-2">
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="font-medium text-foreground">{item.name}</span>
                                                        <span className="tabular-nums text-muted-foreground">
                                                            {item.count} école{item.count > 1 ? "s" : ""} · {Math.round(share)} %
                                                        </span>
                                                    </div>
                                                    <div
                                                        className="h-2 w-full bg-muted rounded-full overflow-hidden"
                                                        role="progressbar"
                                                        aria-label={`Part du plan ${item.name}`}
                                                        aria-valuemin={0}
                                                        aria-valuemax={100}
                                                        aria-valuenow={Math.round(share)}
                                                    >
                                                        <div className="h-full bg-primary" style={{ width: `${share}%` }} />
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>

                        {/* Dernières transactions */}
                        <Card>
                            <CardHeader className="border-b border-border/50">
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    <Receipt className="w-4 h-4 text-primary" aria-hidden="true" />
                                    Flux de trésorerie récent
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {isLoading ? (
                                    <div className="p-4 space-y-3">
                                        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                                    </div>
                                ) : recentPayments.length === 0 ? (
                                    <p className="p-6 text-sm text-muted-foreground">
                                        Aucune transaction récente disponible.
                                    </p>
                                ) : (
                                    <ul className="divide-y divide-border/50">
                                        {recentPayments.map((payment) => (
                                            <li key={payment.id} className="p-4 flex items-center justify-between gap-4">
                                                <div className="flex gap-3 items-center min-w-0">
                                                    <div className="w-8 h-8 shrink-0 rounded-lg bg-success/10 text-success flex items-center justify-center">
                                                        <Wallet className="w-4 h-4" aria-hidden="true" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold truncate">{payment.schoolName}</p>
                                                        <p className="text-xs text-muted-foreground">Paiement validé</p>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-sm font-semibold tabular-nums text-success">+{fcfa(Number(payment.amount))} F</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {payment.paidAt ? new Date(payment.paidAt).toLocaleString("fr-FR") : "Date indisponible"}
                                                    </p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                ) : null}
            </div>
        </PageGuard>
    );
}
