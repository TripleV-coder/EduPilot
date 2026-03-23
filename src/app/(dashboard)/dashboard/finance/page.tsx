"use client";

import { useEffect, useState, useMemo } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { DollarSign, TrendingUp, AlertCircle, CreditCard, Activity, Plus, CalendarClock, CheckCircle, Loader2, ArrowUpDown, Filter, Zap } from "lucide-react";
import Link from "next/link";
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

import { ParentFinanceView } from "@/components/dashboard/finance/parent-finance-view";
import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { useSession } from "next-auth/react";
import { PageCallout } from "@/components/layout/page-callout";
import { t } from "@/lib/i18n";

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
        user: {
            firstName: string;
            lastName: string;
        };
    };
    fee: {
        name: string;
    };
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
        user: {
            firstName: string;
            lastName: string;
        };
    };
    fee: {
        name: string;
    };
    installmentPayments: {
        id: string;
        amount: number;
        dueDate: string;
        status: string;
    }[];
};

type FinanceData = {
    summary: FinanceSummary;
    recentPayments: Payment[];
    overdueStudents: OverdueStudent[];
    paymentsTrend: PaymentTrend[];
};

export default function FinanceDashboardPage() {
    const { data: session } = useSession();
    const [data, setData] = useState<FinanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([]);
    const [plansLoading, setPlansLoading] = useState(true);
    const [payingInstallment, setPayingInstallment] = useState<string | null>(null);

    // Filters
    const [academicYears, setAcademicYears] = useState<any[]>([]);
    const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>("ALL");
    const [selectedPeriodId, setSelectedPeriodId] = useState<string>("ALL");

    // Fetch Academic Years
    useEffect(() => {
        fetch("/api/academic-years")
            .then(r => r.ok ? r.json() : [])
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    setAcademicYears(data);
                    const currentYear = data.find((y: any) => y.isCurrent);
                    if (currentYear) {
                        setSelectedAcademicYearId(currentYear.id);
                    } else {
                        setSelectedAcademicYearId(data[0].id);
                    }
                }
            })
            .catch(() => { });
    }, []);

    // Fetch dashboard data based on filters
    useEffect(() => {
        let cancelled = false;
        if (session?.user?.role === "PARENT") return;
        
        setLoading(true);

        const params = new URLSearchParams();
        if (selectedAcademicYearId !== "ALL") params.set("academicYearId", selectedAcademicYearId);
        if (selectedPeriodId !== "ALL") params.set("periodId", selectedPeriodId);

        fetch(`/api/finance/dashboard?${params.toString()}`, { credentials: "include" })
            .then((r) => {
                if (!r.ok) throw new Error("Erreur de chargement des données financières");
                return r.json();
            })
            .then((d) => {
                if (!cancelled) setData(d);
            })
            .catch((e) => {
                if (!cancelled) setError(e.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [selectedAcademicYearId, selectedPeriodId, session?.user?.role]);

    // Handle Year Change
    const handleYearChange = (yearId: string) => {
        setSelectedAcademicYearId(yearId);
        setSelectedPeriodId("ALL");
    };

    const activeYear = academicYears.find(y => y.id === selectedAcademicYearId);
    const periods = activeYear?.periods || [];

    // Fetch payment plans
    useEffect(() => {
        if (session?.user?.role === "PARENT") return;
        fetch("/api/payment-plans", { credentials: "include" })
            .then((r) => {
                if (!r.ok) throw new Error("Erreur");
                return r.json();
            })
            .then((plans) => setPaymentPlans(plans))
            .catch(() => { })
            .finally(() => setPlansLoading(false));
    }, [session?.user?.role]);

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
                setError(data.error || "Erreur lors du paiement");
                return;
            }
            const plansRes = await fetch("/api/payment-plans", { credentials: "include" });
            if (plansRes.ok) setPaymentPlans(await plansRes.json());
        } catch {
            setError("Erreur réseau");
        } finally {
            setPayingInstallment(null);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("fr-BJ", {
            style: "currency",
            currency: "XOF",
            maximumFractionDigits: 0,
        }).format(amount);
    };

    // --- Charts data transforms ---
    const barChartData = useMemo(() => {
        if (!data?.paymentsTrend) return [];
        const byMonth: Record<string, { received: number; pending: number }> = {};
        for (const t of data.paymentsTrend) {
            const month = new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(new Date(t.date));
            if (!byMonth[month]) byMonth[month] = { received: 0, pending: 0 };
            byMonth[month].received += t.amount;
        }
        const months = Object.keys(byMonth);
        if (months.length > 0 && data.summary.totalPending > 0) {
            const pendingPerMonth = data.summary.totalPending / months.length;
            for (const m of months) {
                byMonth[m].pending = Math.round(pendingPerMonth);
            }
        }
        return months.map(m => ({ month: m, received: byMonth[m].received, pending: byMonth[m].pending }));
    }, [data]);

    const collectionPieData = useMemo(() => {
        if (!data?.summary) return [];
        return [
            { name: "Collecté", value: data.summary.totalCollected, color: CHART_COLORS.excellent },
            { name: "Reste à recouvrer", value: data.summary.totalPending, color: CHART_COLORS.average },
        ];
    }, [data]);

    // --- Payment Plans DataTable columns ---
    const planColumns: ColumnDef<PaymentPlan>[] = useMemo(() => [
        {
            id: "student",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Élève <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            accessorFn: (row) => `${row.student.user.firstName} ${row.student.user.lastName}`,
            cell: ({ row }) => (
                <span className="font-medium">
                    {row.original.student.user.firstName} {row.original.student.user.lastName}
                </span>
            ),
        },
        {
            id: "fee",
            header: "Frais",
            accessorFn: (row) => row.fee.name,
            cell: ({ row }) => <span className="text-muted-foreground">{row.original.fee.name}</span>,
        },
        {
            accessorKey: "totalAmount",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Total <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => <span className="text-right block">{formatCurrency(row.original.totalAmount)}</span>,
        },
        {
            accessorKey: "paidAmount",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Payé <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => <span className="text-right block text-secondary">{formatCurrency(row.original.paidAmount)}</span>,
        },
        {
            id: "installmentsProgress",
            header: "Échéances",
            cell: ({ row }) => {
                const paidCount = row.original.installmentPayments.filter(i => i.status === "PAID").length;
                return <span className="text-center block">{paidCount}/{row.original.installments}</span>;
            },
        },
        {
            id: "status",
            header: "Statut",
            accessorFn: (row) => row.status,
            cell: ({ row }) => (
                <Badge variant={row.original.status === "COMPLETED" ? "default" : "secondary"}>
                    {row.original.status === "COMPLETED" ? "Terminé" : "Actif"}
                </Badge>
            ),
        },
        {
            id: "action",
            header: "",
            cell: ({ row }) => {
                const nextInstallment = row.original.installmentPayments.find(i => i.status === "PENDING");
                if (!nextInstallment) return <span className="text-xs text-muted-foreground">Complet</span>;
                return (
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={payingInstallment === nextInstallment.id}
                        onClick={() => handlePayInstallment(row.original.id, nextInstallment.id)}
                        className="gap-1"
                    >
                        {payingInstallment === nextInstallment.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            <CheckCircle className="h-3 w-3" />
                        )}
                        Payer échéance
                    </Button>
                );
            },
        },
    ], [payingInstallment]);

    return (
        <PageGuard permission={Permission.FINANCE_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "PARENT"]}>
            <div className="space-y-6 dashboard-motion">
                {session?.user?.role === "PARENT" ? (
                    <ParentFinanceView />
                ) : (
                    <>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <PageHeader
                                title="Finances"
                                description="Vue d'ensemble de la santé financière de l'établissement"
                                breadcrumbs={[
                                    { label: "Tableau de bord", href: "/dashboard" },
                                    { label: "Finances" },
                                ]}
                            />
                            <RoleActionGuard allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"]}>
                                <div className="flex items-center gap-3 shrink-0">
                                    <Link href="/dashboard/finance/bulk-invoice">
                                        <Button variant="outline" className="gap-2 shadow-sm border-primary/25 text-primary hover:bg-primary/10">
                                            <Zap className="h-4 w-4" />
                                            Facturation de Masse
                                        </Button>
                                    </Link>
                                    <Link href="/dashboard/finance/fees">
                                        <Button variant="outline" className="gap-2 shadow-sm">
                                            <DollarSign className="h-4 w-4" />
                                            Gérer les Frais
                                        </Button>
                                    </Link>
                                    <Link href="/dashboard/finance/payments/new">
                                        <Button className="gap-2 shadow-sm">
                                            <Plus className="h-4 w-4" />
                                            Nouvel Encaissement
                                        </Button>
                                    </Link>
                                </div>
                            </RoleActionGuard>
                        </div>

                        {/* Filtres Financiers */}
                        <Card className="dashboard-block border-border shadow-sm" data-reveal>
                            <div className="p-4 flex flex-col sm:flex-row items-center gap-4 bg-muted/20">
                                <div className="flex items-center gap-2 text-muted-foreground mr-2">
                                    <Filter className="h-4 w-4" />
                                    <span className="text-sm font-medium">Filtres</span>
                                </div>
                                <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
                                    <Select value={selectedAcademicYearId} onValueChange={handleYearChange}>
                                        <SelectTrigger className="w-[180px] bg-background">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">Toutes les années</SelectItem>
                                            {academicYears.map((year: any) => (
                                                <SelectItem key={year.id} value={year.id}>
                                                    {year.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Select
                                        value={selectedPeriodId}
                                        onValueChange={setSelectedPeriodId}
                                        disabled={selectedAcademicYearId === "ALL" || periods.length === 0}
                                    >
                                        <SelectTrigger className="w-[160px] bg-background">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">Toute l&apos;année</SelectItem>
                                            {periods.map((period: any) => (
                                                <SelectItem key={period.id} value={period.id}>
                                                    {period.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </Card>

                        {loading && (
                            <div className="flex justify-center items-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            </div>
                        )}

                        {error && (
                            <PageCallout
                                icon={AlertCircle}
                                title="Impossible de charger les données financières"
                                description={error}
                                tone="danger"
                                actions={[
                                    { label: "Gérer les frais", href: "/dashboard/finance/fees", variant: "outline" },
                                    { label: "Nouvel encaissement", href: "/dashboard/finance/payments/new" },
                                ]}
                            />
                        )}

                        {!loading && !error && data && (
                            <>
                                {/* Summary Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <Card className="dashboard-block kpi-card border-border bg-card" data-reveal>
                                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Attendu</CardTitle>
                                            <DollarSign className="w-4 h-4 text-primary" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{formatCurrency(data.summary.totalFees)}</div>
                                            <p className="text-xs text-muted-foreground mt-1">Pour l&apos;année académique</p>
                                        </CardContent>
                                    </Card>

                                    <Card className="dashboard-block kpi-card border-border bg-card" data-reveal>
                                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Encaissé</CardTitle>
                                            <TrendingUp className="w-4 h-4 text-secondary" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{formatCurrency(data.summary.totalCollected)}</div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="flex-1 bg-muted h-1.5 rounded-full overflow-hidden">
                                                    <div
                                                        className="bg-secondary h-full"
                                                        style={{ width: `${Math.min(100, data.summary.collectionRate)}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-medium">{data.summary.collectionRate.toFixed(1)}%</span>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="dashboard-block kpi-card border-border bg-card" data-reveal>
                                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">Reste à Recouvrer</CardTitle>
                                            <AlertCircle className="w-4 h-4 text-warning" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{formatCurrency(data.summary.totalPending)}</div>
                                            <p className="text-xs text-muted-foreground mt-1">Montant en attente</p>
                                        </CardContent>
                                    </Card>

                                    <Card className="dashboard-block kpi-card border-border bg-card" data-reveal>
                                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">Volume Transactions</CardTitle>
                                            <Activity className="w-4 h-4 text-info" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{data.recentPayments.length}</div>
                                            <p className="text-xs text-muted-foreground mt-1">Paiements récents</p>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Charts Row */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <Card className="dashboard-block lg:col-span-2 border-border shadow-sm" data-reveal>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <TrendingUp className="w-5 h-5 text-secondary" />
                                                Évolution des Encaissements
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="h-[300px]">
                                            <PaymentBarChart data={barChartData} />
                                        </CardContent>
                                    </Card>

                                    <Card className="dashboard-block border-border shadow-sm" data-reveal>
                                        <CardHeader>
                                            <CardTitle>Répartition Globale</CardTitle>
                                        </CardHeader>
                                        <CardContent className="h-[300px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={collectionPieData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={80}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                    >
                                                        {collectionPieData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip contentStyle={FR_TOOLTIP_STYLE as React.CSSProperties} />
                                                    <Legend />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Lists Row */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <Card className="dashboard-block lg:col-span-2 border-border shadow-sm overflow-hidden" data-reveal>
                                        <CardHeader className="border-b bg-muted/10">
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-lg">Transactions Récentes</CardTitle>
                                                <Link href="/dashboard/finance/payments">
                                                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                                                        {t("appActions.viewAll")}
                                                    </Button>
                                                </Link>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-muted/5 text-muted-foreground">
                                                        <tr className="border-b">
                                                            <th className="px-4 py-3 text-left font-medium">Élève</th>
                                                            <th className="px-4 py-3 text-left font-medium">Frais</th>
                                                            <th className="px-4 py-3 text-right font-medium">Montant</th>
                                                            <th className="px-4 py-3 text-center font-medium">Statut</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-border/50">
                                                        {data.recentPayments.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                                                                    Aucune transaction récente
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            data.recentPayments.map((p) => (
                                                                <tr key={p.id} className="hover:bg-muted/5 transition-colors">
                                                                    <td className="px-4 py-3 font-medium">
                                                                        {p.student.user.firstName} {p.student.user.lastName}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-muted-foreground">{p.fee.name}</td>
                                                                    <td className="px-4 py-3 text-right font-bold text-secondary">
                                                                        {formatCurrency(p.amount)}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        <Badge variant="default" className="bg-secondary hover:bg-secondary/90">
                                                                            Validé
                                                                        </Badge>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="dashboard-block border-border shadow-sm border-l-4 border-l-destructive" data-reveal>
                                        <CardHeader>
                                            <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                                                <AlertCircle className="w-5 h-5" />
                                                Impayés Majeurs
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {data.overdueStudents.length === 0 ? (
                                                <p className="text-sm text-muted-foreground py-4 text-center">Aucun impayé majeur</p>
                                            ) : (
                                                <div className="space-y-4">
                                                    {data.overdueStudents.map((student, i) => (
                                                        <div key={student.studentId || i} className="flex items-center justify-between">
                                                            <p className="font-medium text-sm truncate pr-4">{student.studentName}</p>
                                                            <p className="font-bold text-sm text-destructive">{formatCurrency(student.balance)}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Payment Plans with DataTable */}
                                <Card className="dashboard-block border-border bg-card" data-reveal>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <CalendarClock className="w-5 h-5" />
                                            Plans de Paiement
                                        </CardTitle>
                                        <CardDescription>Échéanciers en cours pour les élèves</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {plansLoading ? (
                                            <div className="flex justify-center py-6">
                                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                            </div>
                                        ) : paymentPlans.length === 0 ? (
                                            <PageCallout
                                                icon={CalendarClock}
                                                title="Aucun plan de paiement"
                                                description="Les plans de paiement apparaîtront ici une fois créés pour des élèves. Vous pouvez commencer par définir les frais puis générer des factures."
                                                actions={[
                                                    { label: "Définir les frais", href: "/dashboard/finance/fees", variant: "outline" },
                                                    { label: "Facturation de masse", href: "/dashboard/finance/bulk-invoice" },
                                                ]}
                                            />
                                        ) : (
                                            <DataTable
                                                columns={planColumns}
                                                data={paymentPlans}
                                                searchKey="student"
                                                searchPlaceholder="Rechercher un élève..."
                                            />
                                        )}
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </>
                )}
            </div>
        </PageGuard>
    );
}
