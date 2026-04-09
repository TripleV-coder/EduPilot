"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { AlertTriangle, ArrowUpDown, DollarSign, FileWarning, Wallet } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { fetcher } from "@/lib/fetcher";

type InstallmentPayment = {
    id: string;
    amount: number;
    dueDate: string;
    status: string;
};

type PaymentPlan = {
    id: string;
    totalAmount: number;
    paidAmount: number;
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
    installmentPayments: InstallmentPayment[];
};

type DebtRow = {
    id: string;
    studentName: string;
    feeName: string;
    overdueInstallments: number;
    oldestDueDate: string | null;
    remainingAmount: number;
    totalAmount: number;
};

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "XOF",
        maximumFractionDigits: 0,
    }).format(value);
}

export function DebtRiskBoard() {
    const { data: plansPayload, isLoading } = useSWR<PaymentPlan[]>(
        "/api/payment-plans?status=OVERDUE",
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 30000 }
    );

    const plans = Array.isArray(plansPayload) ? plansPayload : [];

    const rows = useMemo<DebtRow[]>(
        () =>
            plans.map((plan) => {
                const overdueInstallments = plan.installmentPayments.filter(
                    (installment) => installment.status === "OVERDUE"
                );
                const oldestDueDate = overdueInstallments.length > 0
                    ? overdueInstallments
                        .map((installment) => installment.dueDate)
                        .sort((left, right) => left.localeCompare(right))[0]
                    : null;

                return {
                    id: plan.id,
                    studentName: `${plan.student.user.firstName} ${plan.student.user.lastName}`,
                    feeName: plan.fee.name,
                    overdueInstallments: overdueInstallments.length,
                    oldestDueDate,
                    remainingAmount: Math.max(0, plan.totalAmount - plan.paidAmount),
                    totalAmount: plan.totalAmount,
                };
            }),
        [plans]
    );

    const totalOutstanding = rows.reduce((sum, row) => sum + row.remainingAmount, 0);
    const totalPlans = rows.length;
    const totalOverdueInstallments = rows.reduce((sum, row) => sum + row.overdueInstallments, 0);
    const averageOutstanding = totalPlans > 0 ? Math.round(totalOutstanding / totalPlans) : 0;

    const columns = useMemo<ColumnDef<DebtRow>[]>(
        () => [
            {
                accessorKey: "studentName",
                header: ({ column }) => (
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                        Élève
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                ),
                cell: ({ row }) => <span className="font-semibold text-foreground">{row.original.studentName}</span>,
            },
            {
                accessorKey: "feeName",
                header: "Frais",
                cell: ({ row }) => <span className="text-muted-foreground">{row.original.feeName}</span>,
            },
            {
                accessorKey: "overdueInstallments",
                header: "Échéances en retard",
                cell: ({ row }) => <span>{row.original.overdueInstallments}</span>,
            },
            {
                accessorKey: "oldestDueDate",
                header: "Plus ancien retard",
                cell: ({ row }) =>
                    row.original.oldestDueDate
                        ? new Date(row.original.oldestDueDate).toLocaleDateString("fr-FR")
                        : "—",
            },
            {
                accessorKey: "remainingAmount",
                header: ({ column }) => (
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                        Reste à recouvrer
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                ),
                cell: ({ row }) => <span className="font-semibold text-[#C0392B]">{formatCurrency(row.original.remainingAmount)}</span>,
            },
        ],
        []
    );

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
            <PageHeader
                title="Dettes & Impayés"
                description="Consolidez les plans de paiement en retard critique et priorisez les dossiers à traiter."
                breadcrumbs={[
                    { label: "Tableau de bord", href: "/dashboard" },
                    { label: "Alertes & Risques" },
                    { label: "Dettes & Impayés" },
                ]}
            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>Dossiers en retard</CardDescription>
                        <CardTitle className="flex items-center justify-between text-2xl">
                            {totalPlans}
                            <FileWarning className="h-5 w-5 text-[#C0392B]" />
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>Montant à recouvrer</CardDescription>
                        <CardTitle className="flex items-center justify-between text-2xl">
                            {formatCurrency(totalOutstanding)}
                            <DollarSign className="h-5 w-5 text-[#2D6A4F]" />
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>Échéances en retard</CardDescription>
                        <CardTitle className="flex items-center justify-between text-2xl">
                            {totalOverdueInstallments}
                            <AlertTriangle className="h-5 w-5 text-[#D4830F]" />
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>Retard moyen par dossier</CardDescription>
                        <CardTitle className="flex items-center justify-between text-2xl">
                            {formatCurrency(averageOutstanding)}
                            <Wallet className="h-5 w-5 text-[#2E6DA4]" />
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Dossiers de paiement à risque</CardTitle>
                    <CardDescription>
                        Vue temps réel des plans `OVERDUE` issus du backend financier.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="grid gap-3">
                            {[0, 1, 2, 3].map((item) => (
                                <div key={item} className="h-14 animate-pulse rounded-xl bg-muted/60" />
                            ))}
                        </div>
                    ) : (
                        <DataTable
                            columns={columns}
                            data={rows}
                            searchKey="studentName"
                            searchPlaceholder="Rechercher un élève..."
                            pageSizeOptions={[25, 50, 100]}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
