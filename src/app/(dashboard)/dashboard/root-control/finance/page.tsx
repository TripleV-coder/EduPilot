"use client";

import useSWR from "swr";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  DollarSign, TrendingUp, Building2, 
  ArrowUpRight, PieChart, Download,
  Wallet, Receipt, ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url, { credentials: "include", cache: "no-store" }).then((res) => {
    if (!res.ok) throw new Error("Erreur serveur");
    return res.json();
});

export default function RootFinancePage() {
    const { data } = useSWR("/api/root/finance/summary", fetcher);

    const summary = data?.summary || { totalMonthlyRevenue: 0, activeTenants: 0, averageRevenuePerTenant: 0 };
    const distribution = data?.distribution || [];

    return (
        <PageGuard roles={["SUPER_ADMIN"]}>
            <div className="space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <PageHeader
                        title="Finances Plateforme"
                        description="Suivi du chiffre d'affaires récurrent et de la performance commerciale globale."
                    />
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-9 gap-2 text-xs font-bold uppercase">
                            <Download className="w-4 h-4" /> {t("appActions.exportPdf")}
                        </Button>
                        <Button size="sm" className="h-9 gap-2 text-xs font-bold uppercase bg-emerald-600 hover:bg-emerald-700">
                            <TrendingUp className="w-4 h-4" /> Rapport annuel
                        </Button>
                    </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-none bg-slate-900 text-white shadow-xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-6 opacity-10">
                            <DollarSign className="w-24 h-24" />
                        </div>
                        <CardContent className="p-8 space-y-2">
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">MRR (Chiffre mensuel)</p>
                            <h3 className="text-4xl font-black">{summary.totalMonthlyRevenue.toLocaleString()} <span className="text-xl">FCFA</span></h3>
                            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold mt-4">
                                <ArrowUpRight className="w-4 h-4" />
                                <span>+12.5% vs mois dernier</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none bg-white shadow-sm border border-border/50">
                        <CardContent className="p-8 space-y-2">
                            <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">ARPU (Moyenne/École)</p>
                            <h3 className="text-4xl font-black text-slate-900">{Math.round(summary.averageRevenuePerTenant).toLocaleString()} <span className="text-xl">FCFA</span></h3>
                            <div className="flex items-center gap-1.5 text-blue-600 text-xs font-bold mt-4">
                                <Building2 className="w-4 h-4" />
                                <span>Basé sur {summary.activeTenants} établissements</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none bg-white shadow-sm border border-border/50">
                        <CardContent className="p-8 space-y-2">
                            <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Taux de Recouvrement</p>
                            <h3 className="text-4xl font-black text-slate-900">98.2%</h3>
                            <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold mt-4">
                                <ShieldCheck className="w-4 h-4" />
                                <span>Zéro litige en cours</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Distribution par plan */}
                    <Card className="border-none shadow-sm bg-muted/20">
                        <CardHeader className="border-b border-border/50">
                            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <PieChart className="w-4 h-4 text-primary" />
                                Répartition des Abonnements
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="space-y-4">
                                {distribution.map((item: any, i: number) => (
                                    <div key={i} className="space-y-2">
                                        <div className="flex justify-between items-center text-sm font-bold">
                                            <span>{item.name}</span>
                                            <span className="text-primary">{item.count} écoles</span>
                                        </div>
                                        <div className="h-2 w-full bg-background rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-primary" 
                                                style={{ width: `${(item.count / summary.activeTenants) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Dernières transactions */}
                    <Card className="border-none shadow-sm bg-muted/20">
                        <CardHeader className="border-b border-border/50">
                            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Receipt className="w-4 h-4 text-primary" />
                                Flux de Trésorerie Récent
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border/50">
                                {[
                                    { school: "Lycée de l'Excellence", plan: "Pack Pro", amount: "150,000", date: "Il y a 2h", status: "Reçu" },
                                    { school: "École Saint-Michel", plan: "Pack Starter", amount: "45,000", date: "Hier", status: "Reçu" },
                                    { school: "Groupe Scolaire Lumière", plan: "Pack Enterprise", amount: "450,000", date: "Il y a 3 jours", status: "Reçu" },
                                ].map((t, i) => (
                                    <div key={i} className="p-4 flex items-center justify-between hover:bg-background/40 transition-colors">
                                        <div className="flex gap-3 items-center">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                                                <Wallet className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold">{t.school}</p>
                                                <p className="text-[10px] text-muted-foreground uppercase">{t.plan}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-emerald-600">+{t.amount} F</p>
                                            <p className="text-[10px] text-muted-foreground">{t.date}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </PageGuard>
    );
}
