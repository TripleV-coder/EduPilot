"use client";

import * as React from "react";
import { Button } from "@/components/edu";
import { ComposeDialog } from "@/components/messaging/compose-dialog";

export interface SendJournalButtonProps {
    fiscalYearId: string | null;
    fiscalLabel?: string | null;
}

/**
 * Bouton « Envoyer le journal » : transmet le journal comptable (récapitulatif
 * + lien d'export SYSCOHADA/DGI) à la direction et à la comptabilité via
 * /api/accounting/journal/send. Une note libre peut accompagner l'envoi.
 */
export function SendJournalButton({ fiscalYearId, fiscalLabel }: SendJournalButtonProps) {
    const [open, setOpen] = React.useState(false);

    async function handleSubmit({ content }: { subject: string; content: string }) {
        const res = await fetch("/api/accounting/journal/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                note: content || undefined,
                fiscalYearId: fiscalYearId || undefined,
            }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Échec de l'envoi du journal.");
        }
    }

    return (
        <>
            <Button
                variant="secondary"
                size="sm"
                full
                style={{ marginTop: 12 }}
                icon="sms"
                onClick={() => setOpen(true)}
                title="Transmettre le journal comptable à la direction"
            >
                Envoyer le journal
            </Button>

            <ComposeDialog
                open={open}
                onClose={() => setOpen(false)}
                title="Envoyer le journal comptable"
                subtitle={fiscalLabel ? `Exercice ${fiscalLabel}` : undefined}
                showSubject={false}
                contentOptional
                contentLabel="Note d'accompagnement"
                recipientsHint="Transmis à la direction et à la comptabilité de l'établissement, avec le lien d'export SYSCOHADA/DGI."
                submitLabel="Transmettre"
                successMessage="Journal transmis à la direction."
                onSubmit={handleSubmit}
            />
        </>
    );
}
