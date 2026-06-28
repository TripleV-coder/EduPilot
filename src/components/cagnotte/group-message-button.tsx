"use client";

import * as React from "react";
import { Button } from "@/components/edu";
import { ComposeDialog } from "@/components/messaging/compose-dialog";

export interface GroupMessageButtonProps {
    cagnotteTitle: string;
    classId: string | null;
    classLabel: string | null;
}

/**
 * Bouton « Messagerie groupe » d'une cagnotte : diffuse un message à tous les
 * parents de la classe rattachée via /api/messages/broadcast.
 * Réservé au staff (la route refuse les autres rôles) ; désactivé si la
 * cagnotte n'est pas rattachée à une classe.
 */
export function GroupMessageButton({ cagnotteTitle, classId, classLabel }: GroupMessageButtonProps) {
    const [open, setOpen] = React.useState(false);
    const noClass = !classId;

    async function handleSubmit({ subject, content }: { subject: string; content: string }) {
        const res = await fetch("/api/messages/broadcast", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ classId, subject, content }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Échec de l'envoi groupé.");
        }
    }

    return (
        <>
            <Button
                variant="ghost"
                size="sm"
                full
                icon="sms"
                disabled={noClass}
                title={
                    noClass
                        ? "Cagnotte sans classe rattachée — diffusion indisponible"
                        : "Diffuser un message aux parents de la classe"
                }
                onClick={() => setOpen(true)}
            >
                Messagerie groupe
            </Button>

            <ComposeDialog
                open={open}
                onClose={() => setOpen(false)}
                title="Messagerie groupe"
                subtitle={classLabel ? `Parents de ${classLabel}` : undefined}
                recipientsHint="Le message sera envoyé à tous les parents d'élèves actifs de la classe."
                defaultSubject={`Cagnotte · ${cagnotteTitle}`}
                submitLabel="Diffuser"
                successMessage="Message diffusé aux parents de la classe."
                onSubmit={handleSubmit}
            />
        </>
    );
}
