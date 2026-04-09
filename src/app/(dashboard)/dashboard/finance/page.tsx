"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useSession } from "next-auth/react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { PaymentBarChart } from "@/components/charts/PaymentBarChart";
import {
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { CHART_COLORS, FR_TOOLTIP_STYLE } from "@/components/charts/chart-theme";
import { 
    DollarSign, TrendingUp, AlertCircle, Plus, CalendarClock, 
    CheckCircle, Loader2, ArrowUpDown, Filter, Zap, Activity 
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ParentFinanceView } from "@/components/dashboard/finance/parent-finance-view";
import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { useSchool } from "@/components/providers/school-provider";
import { PageCallout } from "@/components/layout/page-callout";
import { Permission } from "@/lib/rbac/permissions";
import { toast } from "sonner";

type FinanceSummary = {
    totalFees: number;
    totalCollected: number;
    totalPending: number;
    collectionRate: number;
};

type Payment = {
    id: string;
    amount: number;
    status: string;
    createdAt: string;
    student: {
        user: { firstName: string; lastName: string; };
    };
    fee: { name: string; };
};

type OverdueStudent = {
    studentId: string;
    studentName: string;
    balance: number;
};

type PaymentTrend = {
    date: string;
    amount: number;
    count: number;
};

type PaymentPlan = {
    id: string;
    totalAmount: number;
    paidAmount: number;
    installments: number;
    status: string;
    student: {
        user: { firstName: string; lastName: string; };
    };
    fee: { name: string; };
    installmentPayments: {
        id: string;
        amount: number;
        dueDate: string;
        status: string;
    }[];
};

type FinanceDashboardData = {
    summary: FinanceSummary;
    recentPayments: Payment[];
    overdueStudents: OverdueStudent[];
    paymentsTrend: PaymentTrend[];
};

export default function FinanceDashboardPage() {
    const { data: session } = useSession();
    const { schoolId } = useSchool();
    const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>("ALL");
    const [selectedPeriodId, setSelectedPeriodId] = useState<string>("ALL");
    const [payingInstallment, setPayingInstallment] = useState<string | null>(null);

    // Fetch Academic Years for filters
    const { data: academicYears } = useSWR(schoolId ? `/api/academic-years?schoolId=${schoolId}` : null, fetcher);
    
    const activeYear = useMemo(() => 
        Array.isArray(academicYears) ? academicYears.find(y => y.id === selectedAcademicYearId) : null
    , [academicYears, selectedAcademicYearId]);
    
    const periods = activeYear?.periods || [];

    // Main Dashboard Data
    const dashboardQuery = useMemo(() => {
        const params = new URLSearchParams();
        if (schoolId) params.set("schoolId", schoolId);
        if (selectedAcademicYearId !== "ALL") params.set("academicYearId", selectedAcademicYearId);
        if (selectedPeriodId !== "ALL") params.set("periodId", selectedPeriodId);
        return params.toString();
    }, [schoolId, selectedAcademicYearId, selectedPeriodId]);

    const { 
        data: dashData, 
        error: dashError, 
        isLoading: dashLoading,
        mutate: mutateDash
    } = useSWR<FinanceDashboardData>(schoolId ? `/api/finance/dashboard?${dashboardQuery}` : null, fetcher);

    // Payment Plans
    const { 
        data: paymentPlans, 
        isLoading: plansLoading,
        mutate: mutatePlans 
    } = useSWR<PaymentPlan[]>(schoolId ? `/api/payment-plans?schoolId=${schoolId}` : null, fetcher);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("fr-BJ", {
            style: "currency",
            currency: "XOF",
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const handlePayInstallment = async (planId: string, installmentId: string) => {
        setPayingInstallment(installmentId);
        try {
            const res = await fetch(`/api/payment-plans/${planId}/installments/${installmentId}/pay`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ method: "CASH" }),
            });
            if (!res.ok) {
                const data = await res.json();
                toast.error(data.error || "Erreur lors du paiement");
                return;
            }
            toast.success("Paiement enregistré");
            await Promise.all([mutateDash(), mutatePlans()]);
        } catch {
            toast.error("Erreur réseau");
        } finally {
            setPayingInstallment(null);
        }
    };

    // --- Charts data transforms ---
    const barChartData = useMemo(() => {
        if (!dashData?.paymentsTrend) return [];
        const byMonth: Record<string, { received: number; pending: number }> = {};
        for (const t of dashData.paymentsTrend) {
            const month = new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(new Date(t.date));
            if (!byMonth[month]) byMonth[month] = { received: 0, pending: 0 };
            byMonth[month].received += t.amount;
        }
        const months = Object.keys(byMonth);
        if (months.length > 0 && dashData.summary.totalPending > 0) {
            const pendingPerMonth = dashData.summary.totalPending / months.length;
            for (const m of months) {
                byMonth[m].pending = Math.round(pendingPerMonth);
            }
        }
        return months.map(m => ({ month: m, received: byMonth[m].received, pending: byMonth[m].pending }));
    }, [dashData]);

    const collectionPieData = useMemo(() => {
        if (!dashData?.summary) return [];
        return [
            { name: "Collecté", value: dashData.summary.totalCollected, color: CHART_COLORS.excellent },
            { name: "Reste à recouvrer", value: dashData.summary.totalPending, color: CHART_COLORS.average },
        ];
    }, [dashData]);

    const planColumns: ColumnDef<PaymentPlan>[] = useMemo(() => [
        {
            id: "student",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4">
                    Élève <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            accessorFn: (row) => `${row.student.user.firstName} ${row.student.user.lastName}`,
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-bold text-foreground">
                        {row.original.student.user.firstName} {row.original.student.user.lastName}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">{row.original.fee.name}</span>
                </div>
            ),
        },
        {
            accessorKey: "totalAmount",
            header: "Total",
            cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.totalAmount)}</span>,
        },
        {
            accessorKey: "paidAmount",
            header: "Payé",
            cell: ({ row }) => <span className="font-bold text-emerald-600">{formatCurrency(row.original.paidAmount)}</span>,
        },
        {
            id: "installments",
            header: "Échéances",
            cell: ({ row }) => {
                const paidCount = row.original.installmentPayments.filter(i => i.status === "PAID").length;
                return (
                    <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted h-1 rounded-full overflow-hidden w-16">
                            <div className="bg-primary h-full" style={{ width: `${(paidCount/row.original.installments)*100}%` }} />
                        </div>
                        <span className="text-xs font-medium">{paidCount}/{row.original.installments}</span>
                    </div>
                );
            },
        },
        {
            id: "status",
            header: "Statut",
            cell: ({ row }) => (
                <Badge variant={row.original.status === "COMPLETED" ? "default" : "secondary"} className="text-[10px] uppercase font-black">
                    {row.original.status === "COMPLETED" ? "Terminé" : "En cours"}
                </Badge>
            ),
        },
        {
            id: "action",
            header: "",
            cell: ({ row }) => {
                const nextInstallment = row.original.installmentPayments.find(i => i.status === "PENDING");
                if (!nextInstallment) return null;
                return (
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={payingInstallment === nextInstallment.id}
                        onClick={() => handlePayInstallment(row.original.id, nextInstallment.id)}
                        className="h-7 text-[10px] font-bold uppercase gap-1"
                    >
                        {payingInstallment === nextInstallment.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            <CheckCircle className="h-3 w-3" />
                        )}
                        Encaisser
                    </Button>
                );
            },
        },
    ], [payingInstallment]);

    if (session?.user?.role === "PARENT") return <ParentFinanceView />;

    return (
        <PageGuard permission={[Permission.FINANCE_READ]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"]}>
            <div className="space-y-6 dashboard-motion pb-12">
                <PageHeader
                    title="Finances"
                    description="Suivi des encaissements, des impayés et santé financière globale."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Finances" },
                    ]}
                    actions={
                        <RoleActionGuard allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"]}>
                            <div className="flex items-center gap-2">
                                <Link href="/dashboard/finance/bulk-invoice">
                                    <Button variant="outline" size="sm" className="gap-2 hidden md:flex">
                                        <Zap className="h-4 w-4" />
                                        Facturation de Masse
                                    </Button>
                                </Link>
                                <Link href="/dashboard/finance/payments/new">
                                    <Button size="sm" className="gap-2 action-critical">
                                        <Plus className="h-4 w-4" />
                                        Nouvel Encaissement
                                    </Button>
                                </Link>
                            </div>
                        </RoleActionGuard>
                    }
                />

                {/* Filtres contextuels */}
                <div className="flex flex-wrap items-center gap-3 p-4 bg-card border border-border rounded-xl shadow-sm" data-reveal>
                    <div className="flex items-center gap-2 mr-2">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Filtres</span>
                    </div>
                    <Select value={selectedAcademicYearId} onValueChange={(v) => { setSelectedAcademicYearId(v); setSelectedPeriodId("ALL"); }}>
                        <SelectTrigger className="w-[180px] h-9 text-xs">
                            <SelectValue placeholder="Année" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Toutes les années</SelectItem>
                            {Array.isArray(academicYears) && academicYears.map((y: any) => (
                                <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId} disabled={selectedAcademicYearId === "ALL" || periods.length === 0}>
                        <SelectTrigger className="w-[160px] h-9 text-xs">
                            <SelectValue placeholder="Période" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Toute l&apos;année</SelectItem>
                            {periods.map((p: any) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {dashError && (
                    <PageCallout
                        icon={AlertCircle}
                        title="Erreur de chargement"
                        description="Impossible de récupérer les indicateurs financiers."
                        tone="danger"
                    />
                )}

                {dashLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => <Card key={i} className="h-24 animate-pulse bg-muted/20" />)}
                    </div>
                ) : dashData && (
                    <>
                        {/* KPI Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { label: "Total Attendu", value: formatCurrency(dashData.summary.totalFees), color: "text-foreground", icon: DollarSign },
                                { label: "Total Encaissé", value: formatCurrency(dashData.summary.totalCollected), color: "text-emerald-600", icon: TrendingUp, progress: dashData.summary.collectionRate },
                                { label: "Reste à Recouvrer", value: formatCurrency(dashData.summary.totalPending), color: "text-orange-600", icon: AlertCircle },
                                { label: "Recouvrement", value: `${dashData.summary.collectionRate.toFixed(1)}%`, color: "text-primary", icon: Activity },
                            ].map((kpi, i) => (
                                <Card key={i} className="dashboard-block kpi-card border-border bg-card">
                                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{kpi.label}</div>
                                        <kpi.icon className="w-3.5 h-3.5 text-muted-foreground/50" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className={cn("text-2xl metric-serif", kpi.color)}>{kpi.value}</div>
                                        {kpi.progress !== undefined && (
                                            <div className="mt-2 h-1 w-full bg-muted rounded-full overflow-hidden">
                                                <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${Math.min(100, kpi.progress)}%` }} />
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* Visualisations */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <Card className="dashboard-block lg:col-span-2 border-border" data-reveal>
                                <CardHeader><CardTitle className="text-sm font-medium">Évolution des Encaissements</CardTitle></CardHeader>
                                <CardContent className="h-[300px]">
                                    <PaymentBarChart data={barChartData} />
                                </CardContent>
                            </Card>
                            <Card className="dashboard-block border-border" data-reveal>
                                <CardHeader><CardTitle className="text-sm font-medium">Répartition du Recouvrement</CardTitle></CardHeader>
                                <CardContent className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={collectionPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                                {collectionPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                            </Pie>
                                            <Tooltip contentStyle={FR_TOOLTIP_STYLE as React.CSSProperties} />
                                            <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Recent Transactions & Overdue */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <Card className="dashboard-block lg:col-span-2 border-border overflow-hidden" data-reveal>
                                <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between space-y-0">
                                    <CardTitle className="text-sm font-bold uppercase tracking-tight">Derniers Paiements</CardTitle>
                                    <Link href="/dashboard/finance/payments" className="text-[10px] font-black uppercase text-primary hover:underline">Voir tout</Link>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-muted/5 text-muted-foreground border-b uppercase font-bold text-[10px]">
                                                    <th className="px-4 py-3 text-left">Élève</th>
                                                    <th className="px-4 py-3 text-left">Frais</th>
                                                    <th className="px-4 py-3 text-right">Montant</th>
                                                    <th className="px-4 py-3 text-center">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/50">
                                                {dashData.recentPayments.map((p) => (
                                                    <tr key={p.id} className="hover:bg-muted/5 transition-colors group">
                                                        <td className="px-4 py-3 font-bold">{p.student.user.firstName} {p.student.user.lastName}</td>
                                                        <td className="px-4 py-3 text-muted-foreground">{p.fee.name}</td>
                                                        <td className="px-4 py-3 text-right font-black text-emerald-600">{formatCurrency(p.amount)}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            <Badge variant="outline" className="text-[9px] uppercase font-black bg-emerald-50 text-emerald-700 border-emerald-200">Validé</Badge>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="dashboard-block border-border border-l-4 border-l-destructive shadow-lg" data-reveal>
                                <CardHeader>
                                    <CardTitle className="text-sm font-bold uppercase text-destructive flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" />
                                        Alertes Impayés
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {dashData.overdueStudents.length === 0 ? (
                                            <p className="text-xs text-muted-foreground py-4 text-center italic">Aucune alerte critique</p>
                                        ) : dashData.overdueStudents.map((student, i) => (
                                            <div key={student.studentId || i} className="flex items-center justify-between p-2 rounded-lg hover:bg-destructive/5 transition-colors border border-transparent hover:border-destructive/10">
                                                <p className="font-bold text-xs truncate pr-2">{student.studentName}</p>
                                                <p className="font-black text-xs text-destructive">{formatCurrency(student.balance)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Payment Plans Table */}
                        <Card className="dashboard-block border-border bg-card" data-reveal>
                            <CardHeader>
                                <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
                                    <CalendarClock className="w-4 h-4 text-primary" />
                                    Gestion des Échéanciers
                                </CardTitle>
                                <CardDescription className="text-xs">Plans de paiement actifs et progression des encaissements.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {plansLoading ? (
                                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                                ) : (
                                    <DataTable
                                        columns={planColumns}
                                        data={paymentPlans || []}
                                        searchKey="student"
                                        searchPlaceholder="Rechercher un élève ou un frais..."
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </PageGuard>
    );
}
