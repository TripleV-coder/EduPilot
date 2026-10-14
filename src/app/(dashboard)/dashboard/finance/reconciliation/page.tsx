"use client";

import { useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageError } from "@/components/layout/page-states";
import { Card, CardContent } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { Link2, AlertCircle, Search, Loader2, FilterX, Wallet, Clock3 } from "lucide-react";
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
import { toast } from "sonner";
import { SectionToolbar } from "@/components/ui/section-toolbar";
import { MetricCardPro } from "@/components/ui/metric-card-pro";
import { EmptyStateAction } from "@/components/ui/empty-state";

type PendingPayment = {
    id: string;
    amount: number;
    status: string;
    reference?: string | null;
    createdAt: string;
    label?: string | null;
    description?: string | null;
    date?: string | null;
};

type PendingPaymentsResponse = {
    data?: PendingPayment[];
    payments?: PendingPayment[];
};

export default function FinanceReconciliationPage() {
    const [reconcilingId, setReconcilingId] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [statement, setStatement] = useState<Array<{ date: string; label: string; amount: number; reference: string; matched: boolean }>>([]);
    const { data: paymentsData, isLoading, error: loadError, mutate: reloadPage } = useSWR<PendingPaymentsResponse>(
        "/api/finance/payments?status=PENDING&limit=50",
        fetcher
    );

    const pendingPayments: PendingPayment[] = paymentsData?.payments ?? paymentsData?.data ?? [];
    const filteredPayments = useMemo(() => {
        if (!search.trim()) return pendingPayments;
        const q = search.toLowerCase();
        return pendingPayments.filter((payment) =>
            String(payment.label ?? payment.description ?? "").toLowerCase().includes(q) ||
            String(payment.reference ?? "").toLowerCase().includes(q) ||
            String(payment.amount ?? "").toLowerCase().includes(q)
        );
    }, [pendingPayments, search]);
    const pendingCount = pendingPayments.length;
    const pendingTotalAmount = pendingPayments.reduce((sum: number, payment) => sum + Number(payment.amount || 0), 0);

    const importStatement = async (file: File) => {
        const text = await file.text();
        const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        if (lines.length < 2) {
            toast.error("Le relevé CSV est vide.");
            return;
        }
        const split = (line: string) => line.split(/[;,]/).map((cell) => cell.trim());
        const header = split(lines[0]).map((cell) => cell.toLowerCase());
        const col = (name: string) => header.findIndex((cell) => cell.includes(name));
        const dateIdx = col("date");
        const labelIdx = col("libel");
        const amountIdx = col("montant");
        const refIdx = col("ref");
        const rows = lines.slice(1).map((line) => {
            const cells = split(line);
            const amount = Number(String(cells[amountIdx] ?? "").replace(/\s/g, "").replace(",", "."));
            const reference = refIdx >= 0 ? cells[refIdx] ?? "" : "";
            const matched = pendingPayments.some((payment) => {
                const sameRef = reference && payment.reference && payment.reference === reference;
                const sameAmount = Number.isFinite(amount) && Number(payment.amount) === amount;
                return Boolean(sameRef || sameAmount);
            });
            return {
                date: dateIdx >= 0 ? cells[dateIdx] ?? "" : "",
                label: labelIdx >= 0 ? cells[labelIdx] ?? "" : "",
                amount: Number.isFinite(amount) ? amount : 0,
                reference,
                matched,
            };
        });
        setStatement(rows);
        const hits = rows.filter((row) => row.matched).length;
        toast.success(`${rows.length} ligne${rows.length > 1 ? "s" : ""} lue${rows.length > 1 ? "s" : ""}, ${hits} correspondance${hits > 1 ? "s" : ""}.`);
    };

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
            toast.success("Paiement réconcilié avec succès.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Erreur de réconciliation");
        } finally {
            setReconcilingId(null);
        }
    };

    return (
        <PageGuard permission={[Permission.FEE_UPDATE]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"]}>
            <PageShell>
                <PageHeader
                    title="Réconciliation bancaire"
                    description="Associez les virements reçus aux factures des élèves"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Finance", href: "/dashboard/finance" },
                        { label: "Réconciliation" },
                    ]}
                />

            {loadError ? (
                <PageError message="Impossible de charger les paiements à rapprocher." onRetry={() => void reloadPage()} />
            ) : null}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <MetricCardPro label="Paiements en attente" value={pendingCount} hint="Entrées à valider manuellement" icon={Clock3} tone="warning" />
                    <MetricCardPro label="Montant à traiter" value={`${pendingTotalAmount.toLocaleString("fr-FR")} FCFA`} hint="Somme totale non réconciliée" icon={Wallet} tone="primary" />
                    <MetricCardPro label="Résultats filtrés" value={filteredPayments.length} hint="Selon la recherche courante" icon={Search} tone="success" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="md:col-span-1 space-y-4">
                        <Card className="border-border shadow-sm">
                            <CardContent className="pt-6">
                                <h2 className="font-medium text-foreground mb-2">{t("appActions.importStatement")}</h2>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Importez votre relevé bancaire (CSV) pour faire correspondre automatiquement les paiements.
                                </p>
                                <input
                                    type="file"
                                    accept=".csv,text/csv"
                                    aria-label="Importer CSV"
                                    className="mb-3 block w-full text-sm"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) void importStatement(file);
                                    }}
                                />
                                <Button type="button" variant="outline" className="w-full" onClick={() => document.querySelector<HTMLInputElement>('main input[type="file"]')?.click()}>
                                    {t("common.import")} CSV
                                </Button>
                                {statement.length > 0 ? (
                                    <ul className="mt-4 space-y-2 text-sm">
                                        {statement.map((row) => (
                                            <li key={`${row.reference}-${row.amount}`}>
                                                {row.date} · {row.label} · {row.amount.toLocaleString("fr-FR")} FCFA
                                                {row.reference ? ` · ${row.reference}` : ""}
                                                {" — "}
                                                {row.matched ? "correspondance trouvée" : "aucune correspondance"}
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-none bg-primary/5 text-primary border-primary/20">
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <AlertCircle className="w-5 h-5" />
                                    <h2 className="font-medium">Paiements en attente</h2>
                                </div>
                                <p className="text-2xl font-bold">{isLoading ? "..." : `${pendingCount} virements`}</p>
                                <p className="text-sm opacity-80 mt-1">Nécessitent une validation manuelle</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="md:col-span-3">
                        <Card className="p-4 rounded-xl shadow-sm border border-border">
                            <SectionToolbar
                                className="mb-4 p-3 sm:p-4"
                                title="Filtrage rapide"
                                description="Recherchez par libellé, référence ou montant pour réconcilier plus vite."
                                leading={
                                    <div className="relative flex-1 min-w-[280px]">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Rechercher un libellé, une référence ou un montant..."
                                            aria-label="Rechercher un paiement en attente"
                                            className="pl-9 bg-muted/50 border-border"
                                        />
                                    </div>
                                }
                                actions={
                                    <Button type="button" variant="outline" onClick={() => setSearch("")} disabled={!search} className="gap-2">
                                        <FilterX className="w-4 h-4" />
                                        Réinitialiser
                                    </Button>
                                }
                            />

                            {isLoading ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                                    Chargement des paiements...
                                </div>
                            ) : filteredPayments.length === 0 ? (
                                <EmptyStateAction
                                    icon={AlertCircle}
                                    title="Aucun paiement à afficher"
                                    description={search ? "Aucun paiement ne correspond à votre filtre actuel." : "Il n'y a pas de paiement en attente pour le moment."}
                                    actionLabel={search ? "Effacer le filtre" : undefined}
                                    onAction={search ? () => setSearch("") : undefined}
                                />
                            ) : (
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
                                        {(
                                            filteredPayments.map((payment) => (
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
                                                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 font-normal">
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
                            )}
                        </Card>
                    </div>
                </div>
            </PageShell>
        </PageGuard>
    );
}
