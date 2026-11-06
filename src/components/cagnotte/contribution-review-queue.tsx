"use client";

import * as React from "react";

import { Badge, Button, Card, Input } from "@/components/edu";

export type PendingContribution = {
    id: string;
    parentName: string | null;
    initials: string;
    amountFcfa: string;
    paymentRef: string | null;
    paidAt: string;
};

const FR_NUMBER = new Intl.NumberFormat("fr-FR");
const FR_DATETIME = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
});

/**
 * File de validation des contributions déclarées (TD-019), réservée au
 * comptable et à la direction. Confirmer = la somme a été reçue (espèces au
 * guichet, relevé Mobile Money vérifié) ; rejeter exige un motif, que la
 * famille reçoit dans sa notification.
 */
export function ContributionReviewQueue({
    cagnotteId,
    pending,
    pendingFcfa,
    onReviewed,
}: {
    cagnotteId: string;
    pending: PendingContribution[];
    pendingFcfa: string;
    onReviewed: () => Promise<unknown> | void;
}) {
    const [busyId, setBusyId] = React.useState<string | null>(null);
    const [rejectingId, setRejectingId] = React.useState<string | null>(null);
    const [note, setNote] = React.useState("");
    const [error, setError] = React.useState<string | null>(null);

    async function review(id: string, decision: "CONFIRM" | "REJECT") {
        setError(null);
        setBusyId(id);
        try {
            const res = await fetch(`/api/cagnottes/${cagnotteId}/contributions/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(decision === "REJECT" ? { decision, note } : { decision }),
            });
            const json = (await res.json().catch(() => ({}))) as { error?: string };
            // 409 : déjà traitée ailleurs — on rafraîchit sans message d'échec.
            if (!res.ok && res.status !== 409) {
                setError(json.error ?? "La décision n'a pas été enregistrée.");
                return;
            }
            setRejectingId(null);
            setNote("");
            await onReviewed();
        } catch {
            setError("Erreur réseau. Réessayez.");
        } finally {
            setBusyId(null);
        }
    }

    return (
        <Card padding={0}>
            <div
                style={{
                    padding: "14px 18px",
                    borderBottom: "1px solid var(--eduflow-border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                }}
            >
                <div>
                    <h2 className="eduflow-display" style={{ fontSize: 15, margin: 0 }}>
                        À valider · {pending.length}
                    </h2>
                    <p style={{ fontSize: 12, color: "var(--eduflow-text-tertiary)", margin: "2px 0 0" }}>
                        Déclarées par les familles, hors du total tant qu&apos;elles ne sont pas confirmées
                    </p>
                </div>
                {pending.length > 0 ? (
                    <Badge variant="warning" size="sm">
                        {FR_NUMBER.format(Number(pendingFcfa))} FCFA
                    </Badge>
                ) : null}
            </div>

            {error ? (
                <div role="alert" style={{ padding: "10px 18px 0" }}>
                    <Badge variant="danger">{error}</Badge>
                </div>
            ) : null}

            {pending.length === 0 ? (
                <p style={{ padding: 18, fontSize: 12, color: "var(--eduflow-text-tertiary)", margin: 0 }}>
                    Aucune contribution en attente.
                </p>
            ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {pending.map((c, i) => (
                        <li
                            key={c.id}
                            style={{
                                padding: "12px 18px",
                                borderTop: i ? "1px solid var(--eduflow-border-subtle)" : 0,
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                            }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                                        {c.parentName ?? c.initials}
                                    </div>
                                    <div style={{ fontSize: 12, color: "var(--eduflow-text-tertiary)" }}>
                                        {FR_DATETIME.format(new Date(c.paidAt))}
                                        {c.paymentRef ? ` · Réf. ${c.paymentRef}` : " · sans référence"}
                                    </div>
                                </div>
                                <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 700 }}>
                                    {FR_NUMBER.format(Number(c.amountFcfa))} FCFA
                                </span>
                            </div>

                            {rejectingId === c.id ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    <Input
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        placeholder="Motif (ex. aucune somme reçue à ce nom)"
                                        aria-label={`Motif du rejet de la contribution de ${c.parentName ?? c.initials}`}
                                    />
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <Button
                                            size="sm"
                                            variant="danger"
                                            loading={busyId === c.id}
                                            disabled={note.trim().length < 3}
                                            onClick={() => review(c.id, "REJECT")}
                                        >
                                            Confirmer le rejet
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                setRejectingId(null);
                                                setNote("");
                                            }}
                                        >
                                            Annuler
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: "flex", gap: 8 }}>
                                    <Button
                                        size="sm"
                                        icon="check"
                                        loading={busyId === c.id}
                                        disabled={busyId !== null}
                                        onClick={() => review(c.id, "CONFIRM")}
                                    >
                                        Somme reçue
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        disabled={busyId !== null}
                                        onClick={() => {
                                            setRejectingId(c.id);
                                            setNote("");
                                        }}
                                    >
                                        Rejeter
                                    </Button>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}
