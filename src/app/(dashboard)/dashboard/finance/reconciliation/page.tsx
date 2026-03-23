"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { Link2, AlertCircle, Search, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export default function FinanceReconciliationPage() {
    const [reconcilingId, setReconcilingId] = useState<string | null>(null);
    const { data: paymentsData, isLoading } = useSWR(
        "/api/finance/payments?status=PENDING&limit=50",
        fetcher
    );

    const pendingPayments = paymentsData?.payments ?? paymentsData?.data ?? [];
    const pendingCount = pendingPayments.length;

    const handleReconcile = async (paymentId: string) => {
        setReconcilingId(paymentId);
        try {
            const res = await fetch("/api/payments/reconcile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paymentId }),
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || "Erreur de réconciliation");
            }
            await mutate("/api/finance/payments?status=PENDING&limit=50");
        } catch (err) {
            console.error(err);
        } finally {
            setReconcilingId(null);
        }
    };

    return (
        <PageGuard permission={[Permission.FEE_UPDATE]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"]}>
            <div className="space-y-6">
                <PageHeader
                    title="Réconciliation Bancaire"
                    description="Associez les virements reçus aux factures des élèves"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Finance", href: "/dashboard/finance" },
                        { label: "Réconciliation" },
                    ]}
                />

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="md:col-span-1 space-y-4">
                        <Card className="border-border shadow-sm">
                            <CardContent className="pt-6">
                                <h3 className="font-medium text-foreground mb-2">{t("appActions.importStatement")}</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Importez votre relevé bancaire (CSV) pour faire correspondre automatiquement les paiements.
                                </p>
                                <Button variant="outline" className="w-full">
                                    {t("common.import")} CSV
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-none bg-primary/5 text-primary border-primary/20">
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <AlertCircle className="w-5 h-5" />
                                    <h3 className="font-medium">Paiements en attente</h3>
                                </div>
                                <p className="text-2xl font-bold">{isLoading ? "..." : `${pendingCount} virements`}</p>
                                <p className="text-sm opacity-80 mt-1">Nécessitent une validation manuelle</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="md:col-span-3">
                        <Card className="p-4 rounded-xl shadow-sm border border-border">
                            <div className="flex gap-4 mb-6">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        
                                        className="pl-9 bg-muted/50 border-border"
                                    />
                                </div>
                            </div>

                            <div className="border border-border rounded-lg overflow-hidden bg-background">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="font-semibold text-muted-foreground">Date Opération</TableHead>
                                            <TableHead className="font-semibold text-muted-foreground">Libellé Bancaire</TableHead>
                                            <TableHead className="font-semibold text-muted-foreground">Montant</TableHead>
                                            <TableHead className="font-semibold text-muted-foreground">Statut</TableHead>
                                            <TableHead className="font-semibold text-muted-foreground text-right">Association</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                                                    Chargement des paiements...
                                                </TableCell>
                                            </TableRow>
                                        ) : pendingPayments.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                    Aucun paiement en attente de réconciliation.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            pendingPayments.map((payment: any) => (
                                                <TableRow key={payment.id} className={payment.status === "RECONCILED" ? "bg-muted/10" : "hover:bg-muted/30 transition-colors"}>
                                                    <TableCell className="text-sm text-foreground">
                                                        {new Date(payment.date ?? payment.createdAt).toLocaleDateString("fr-FR")}
                                                    </TableCell>
                                                    <TableCell>
                                                        <p className="font-medium text-foreground text-sm flex items-center gap-2">
                                                            {payment.label ?? payment.description ?? "Paiement"}
                                                        </p>
                                                        {payment.reference && (
                                                            <p className="text-xs text-muted-foreground">REF: {payment.reference}</p>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="font-bold text-foreground">
                                                        {Number(payment.amount).toLocaleString("fr-FR")} FCFA
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 font-normal">
                                                            Attente Match
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary"
                                                            disabled={reconcilingId === payment.id}
                                                            onClick={() => handleReconcile(payment.id)}
                                                        >
                                                            {reconcilingId === payment.id ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <Link2 className="w-4 h-4" />
                                                            )}
                                                            Réconcilier
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </PageGuard>
    );
}
