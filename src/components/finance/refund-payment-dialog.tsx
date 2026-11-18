"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/edu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const METHODS: Array<{ value: string; label: string }> = [
    { value: "CASH", label: "Espèces" },
    { value: "MOBILE_MONEY_MTN", label: "MTN Mobile Money" },
    { value: "MOBILE_MONEY_MOOV", label: "Moov Money" },
    { value: "BANK_TRANSFER", label: "Virement bancaire" },
    { value: "CHECK", label: "Chèque" },
    { value: "OTHER", label: "Autre" },
];

const FCFA = new Intl.NumberFormat("fr-FR");

export type RefundablePayment = {
    id: string;
    amount: number;
    studentName: string;
    feeName: string;
};

/**
 * Remboursement d'un paiement encaissé (comptable, direction). Le montant
 * maximal est contrôlé par le serveur (cumul des remboursements ≤ montant
 * payé) ; le motif est obligatoire et la famille est prévenue.
 */
export function RefundPaymentDialog({
    payment,
    open,
    onOpenChange,
    onRefunded,
}: {
    payment: RefundablePayment | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRefunded: () => void;
}) {
    const [amount, setAmount] = React.useState("");
    const [method, setMethod] = React.useState("CASH");
    const [reason, setReason] = React.useState("");
    const [reference, setReference] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (open && payment) {
            setAmount(String(Math.round(payment.amount)));
            setMethod("CASH");
            setReason("");
            setReference("");
            setError(null);
        }
    }, [open, payment]);

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        if (!payment) return;
        setError(null);
        const value = Number(amount);
        if (!Number.isInteger(value) || value <= 0) {
            setError("Saisissez un montant entier en FCFA, supérieur à 0.");
            return;
        }
        if (reason.trim().length < 5) {
            setError("Indiquez le motif du remboursement (5 caractères minimum).");
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch(`/api/payments/${payment.id}/refund`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: value,
                    method,
                    reason: reason.trim(),
                    reference: reference.trim() || null,
                }),
            });
            const body = (await res.json().catch(() => ({}))) as { error?: string; providerAction?: string | null };
            if (!res.ok) {
                setError(body.error ?? "Le remboursement n'a pas été enregistré.");
                return;
            }
            toast.success(`Remboursement de ${FCFA.format(value)} FCFA enregistré`, {
                description: body.providerAction ?? "Le reste à payer et l'échéancier sont mis à jour ; la famille est prévenue.",
            });
            onOpenChange(false);
            onRefunded();
        } catch {
            setError("Connexion impossible. Réessayez.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>Rembourser un paiement</DialogTitle>
                        <DialogDescription>
                            {payment
                                ? `${payment.studentName} · ${payment.feeName} · payé ${FCFA.format(Math.round(payment.amount))} FCFA`
                                : ""}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-1.5">
                        <Label htmlFor="refund-amount">Montant remboursé (FCFA)</Label>
                        <Input
                            id="refund-amount"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            step={1}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="refund-method">Mode de remboursement</Label>
                        <select
                            id="refund-method"
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                            {METHODS.map((m) => (
                                <option key={m.value} value={m.value}>
                                    {m.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="refund-reason">Motif</Label>
                        <Textarea
                            id="refund-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Ex. départ de l'élève, trop-perçu, activité annulée"
                            maxLength={500}
                            rows={3}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="refund-reference">Référence (facultatif)</Label>
                        <Input
                            id="refund-reference"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            placeholder="N° de transaction, de chèque ou de virement"
                            maxLength={120}
                        />
                    </div>

                    <p className="text-xs leading-relaxed text-muted-foreground">
                        Le remboursement est inscrit en négatif sur le compte de l&apos;élève : le reste à
                        payer et les échéances sont recalculés. Pour un paiement en ligne, rendez la somme
                        depuis l&apos;espace du fournisseur ; EduPilot en garde la trace.
                    </p>

                    {error ? (
                        <p role="alert" className="text-sm font-medium text-destructive">
                            {error}
                        </p>
                    ) : null}

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            Annuler
                        </Button>
                        <Button type="submit" variant="danger" loading={submitting}>
                            Enregistrer le remboursement
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
