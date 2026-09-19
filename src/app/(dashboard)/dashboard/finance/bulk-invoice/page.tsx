"use client";

import { useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageError } from "@/components/layout/page-states";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Permission } from "@/lib/rbac/permissions";
import { fetcher } from "@/lib/fetcher";
import { getErrorMessage } from "@/lib/utils/error-message";
import { AlertCircle, Download, FileText, ListChecks, Loader2 } from "lucide-react";

type ClassLevelOption = { id: string; name: string; code: string };
type FeeOption = {
    id: string;
    name: string;
    amount: string | number;
    classLevelCode: string | null;
    academicYear: { id: string; name: string } | null;
};
type NoticeRow = {
    studentId: string;
    firstName: string;
    lastName: string;
    matricule: string;
    className: string;
    due: number;
    paid: number;
    pending: number;
    remaining: number;
};
type NoticeSummary = {
    fee: { name: string };
    classLevel: { name: string };
    academicYear: { name: string };
    rows: NoticeRow[];
    totals: { students: number; debtors: number; due: number; paid: number; remaining: number };
};

const fcfa = (amount: number) => `${Math.round(amount).toLocaleString("fr-FR")} FCFA`;

export default function PaymentNoticesPage() {
    const [selectedLevel, setSelectedLevel] = useState("");
    const [selectedFee, setSelectedFee] = useState("");
    const [summary, setSummary] = useState<NoticeSummary | null>(null);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Seule la réponse à la dernière sélection s'affiche, même si une précédente arrive après.
    const latestRequest = useRef(0);

    const levels = useSWR<ClassLevelOption[]>("/api/class-levels", fetcher);
    const fees = useSWR<FeeOption[]>("/api/fees", fetcher);

    const level = levels.data?.find((l) => l.id === selectedLevel);
    // Un frais restreint à un niveau (classLevelCode) ne s'applique qu'à ce niveau.
    const applicableFees = useMemo(
        () => (fees.data ?? []).filter((fee) => !level || !fee.classLevelCode || fee.classLevelCode === level.code),
        [fees.data, level]
    );

    const postNotices = (classLevelId: string, feeId: string, format: "summary" | "pdf") =>
        fetch("/api/finance/payment-notices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ feeId, classLevelId, format }),
        });

    const loadSummary = async (levelId: string, feeId: string) => {
        const requestId = ++latestRequest.current;
        setSummary(null);
        setError(null);
        if (!levelId || !feeId) {
            setLoadingSummary(false);
            return;
        }
        setLoadingSummary(true);
        try {
            const res = await postNotices(levelId, feeId, "summary");
            const data = await res.json();
            if (requestId !== latestRequest.current) return;
            if (!res.ok) throw new Error(data.error || "Impossible de calculer les soldes");
            setSummary(data);
        } catch (err) {
            if (requestId === latestRequest.current) setError(getErrorMessage(err));
        } finally {
            if (requestId === latestRequest.current) setLoadingSummary(false);
        }
    };

    const handleLevelChange = (value: string) => {
        setSelectedLevel(value);
        const nextLevel = levels.data?.find((l) => l.id === value);
        const fee = fees.data?.find((f) => f.id === selectedFee);
        const stillApplicable = fee && (!fee.classLevelCode || fee.classLevelCode === nextLevel?.code);
        const feeId = stillApplicable ? selectedFee : "";
        if (!stillApplicable) setSelectedFee("");
        void loadSummary(value, feeId);
    };

    const handleFeeChange = (value: string) => {
        setSelectedFee(value);
        void loadSummary(selectedLevel, value);
    };

    const handleDownload = async () => {
        setDownloading(true);
        setError(null);
        try {
            const res = await postNotices(selectedLevel, selectedFee, "pdf");
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Impossible de générer les avis");
            }
            const blob = await res.blob();
            const filename = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "avis-paiement.pdf";
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setDownloading(false);
        }
    };

    const listsError = levels.error || fees.error;

    return (
        <PageGuard permission={[Permission.FEE_READ]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"]}>
            <PageShell>
                <PageHeader
                    title="Avis de paiement"
                    description="Reste à payer d'un frais pour tout un niveau, et avis à remettre aux familles"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Finance", href: "/dashboard/finance" },
                        { label: "Avis de paiement" },
                    ]}
                />

                {listsError ? (
                    <PageError
                        message={getErrorMessage(listsError)}
                        onRetry={() => {
                            void levels.mutate();
                            void fees.mutate();
                        }}
                    />
                ) : (
                    <div className="space-y-6">
                        <Card className="border-border shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <FileText className="w-5 h-5 text-primary" />
                                    Niveau et frais
                                </CardTitle>
                                <CardDescription>
                                    Le reste à payer de chaque élève est calculé à partir du montant du frais et de ses paiements validés.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="level">Niveau</Label>
                                    <Select value={selectedLevel} onValueChange={handleLevelChange} disabled={levels.isLoading}>
                                        <SelectTrigger id="level" className="bg-background">
                                            <SelectValue placeholder={levels.isLoading ? "Chargement…" : "Choisir un niveau"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(levels.data ?? []).map((cl) => (
                                                <SelectItem key={cl.id} value={cl.id}>{cl.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="fee">Frais</Label>
                                    <Select value={selectedFee} onValueChange={handleFeeChange} disabled={fees.isLoading || applicableFees.length === 0}>
                                        <SelectTrigger id="fee" className="bg-background">
                                            <SelectValue
                                                placeholder={
                                                    fees.isLoading ? "Chargement…" : applicableFees.length === 0 ? "Aucun frais actif pour ce niveau" : "Choisir un frais"
                                                }
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {applicableFees.map((fee) => (
                                                <SelectItem key={fee.id} value={fee.id}>
                                                    {fee.name} — {fcfa(Number(fee.amount))}
                                                    {fee.academicYear ? ` (${fee.academicYear.name})` : ""}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardContent>
                        </Card>

                        {error && (
                            <div role="alert" className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        {loadingSummary ? (
                            <div className="py-12 flex justify-center" aria-live="polite">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                <span className="sr-only">Calcul des soldes…</span>
                            </div>
                        ) : !summary ? (
                            !error && (
                                <div className="text-center py-12 border border-dashed rounded-xl bg-muted/20">
                                    <ListChecks className="mx-auto w-10 h-10 text-muted-foreground/50 mb-3" />
                                    <p className="text-sm text-muted-foreground">Choisissez un niveau et un frais pour voir le reste à payer de chaque élève.</p>
                                </div>
                            )
                        ) : (
                            <Card className="border-border shadow-sm">
                                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="text-lg">
                                            {summary.fee.name} — {summary.classLevel.name}
                                        </CardTitle>
                                        <CardDescription>
                                            Année {summary.academicYear.name} · {summary.totals.students} élève(s) inscrit(s) ·{" "}
                                            <span className="font-medium text-foreground">{summary.totals.debtors} débiteur(s)</span> ·
                                            reste {fcfa(summary.totals.remaining)} sur {fcfa(summary.totals.due)}
                                        </CardDescription>
                                    </div>
                                    <Button onClick={handleDownload} disabled={downloading || summary.totals.debtors === 0} className="gap-2 shrink-0">
                                        {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                        {summary.totals.debtors > 0 ? `Télécharger ${summary.totals.debtors} avis (PDF)` : "Aucun avis à émettre"}
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    {summary.rows.length === 0 ? (
                                        <p className="text-sm text-muted-foreground py-6 text-center">Aucun élève inscrit dans ce niveau pour cette année.</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Élève</TableHead>
                                                        <TableHead>Classe</TableHead>
                                                        <TableHead className="text-right">Réglé</TableHead>
                                                        <TableHead className="text-right">En vérification</TableHead>
                                                        <TableHead className="text-right">Reste à payer</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {summary.rows.map((row) => (
                                                        <TableRow key={row.studentId}>
                                                            <TableCell>
                                                                <div className="font-medium">{row.lastName} {row.firstName}</div>
                                                                <div className="text-xs text-muted-foreground">{row.matricule}</div>
                                                            </TableCell>
                                                            <TableCell>{row.className}</TableCell>
                                                            <TableCell className="text-right tabular-nums">{fcfa(row.paid)}</TableCell>
                                                            <TableCell className="text-right tabular-nums text-muted-foreground">
                                                                {row.pending > 0 ? fcfa(row.pending) : "—"}
                                                            </TableCell>
                                                            <TableCell className={`text-right tabular-nums font-semibold ${row.remaining > 0 ? "text-destructive" : "text-[hsl(var(--success))]"}`}>
                                                                {row.remaining > 0 ? fcfa(row.remaining) : "Soldé"}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}
            </PageShell>
        </PageGuard>
    );
}
