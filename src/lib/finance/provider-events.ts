/**
 * Journal des événements fournisseur (FIN-02, 2026-11-24) — voir le modèle
 * PaymentProviderEvent. Écrit APRÈS la vérification de signature et AVANT le
 * traitement : un événement reçu reste visible même si son traitement échoue.
 * Un échec d'écriture du journal n'empêche jamais l'encaissement (journalisé).
 */
import { createHash } from "node:crypto";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

export interface ProviderEventInput {
    provider: string;
    eventName: string;
    rawBody: string;
    schoolId?: string | null;
    paymentAccountId?: string | null;
    reference?: string | null;
    transactionId?: string | null;
    amount?: number | null;
    currency?: string | null;
    providerStatus?: string | null;
}

/** Clé stable d'un événement : nom + transaction + référence, sinon empreinte du corps. */
export function providerEventKey(input: Pick<ProviderEventInput, "eventName" | "transactionId" | "reference" | "rawBody">): string {
    if (input.transactionId) return `${input.eventName}:${input.transactionId}:${input.reference ?? ""}`;
    return `${input.eventName}:sha256:${createHash("sha256").update(input.rawBody).digest("hex")}`;
}

/** Enregistre l'événement (ou compte sa nouvelle réception). Renvoie son id, ou null si le journal est indisponible. */
export async function recordProviderEvent(input: ProviderEventInput): Promise<string | null> {
    const eventKey = providerEventKey(input);
    try {
        const row = await prisma.paymentProviderEvent.upsert({
            where: { provider_eventKey: { provider: input.provider, eventKey } },
            create: {
                provider: input.provider,
                eventKey,
                eventName: input.eventName.slice(0, 100),
                schoolId: input.schoolId ?? null,
                paymentAccountId: input.paymentAccountId ?? null,
                reference: input.reference?.slice(0, 200) ?? null,
                transactionId: input.transactionId?.slice(0, 100) ?? null,
                amount: input.amount ?? null,
                currency: input.currency?.slice(0, 10) ?? null,
                providerStatus: input.providerStatus?.slice(0, 50) ?? null,
            },
            update: { receivedCount: { increment: 1 }, lastReceivedAt: new Date() },
            select: { id: true },
        });
        return row.id;
    } catch (error) {
        logger.error("Journal des événements fournisseur : écriture impossible", error as Error, { provider: input.provider, eventKey });
        return null;
    }
}

/** Résultat du (dernier) traitement de l'événement. */
export async function recordProviderEventOutcome(eventId: string | null, outcome: string): Promise<void> {
    if (!eventId) return;
    try {
        await prisma.paymentProviderEvent.update({ where: { id: eventId }, data: { outcome: outcome.slice(0, 100) } });
    } catch (error) {
        logger.error("Journal des événements fournisseur : résultat non enregistré", error as Error, { eventId, outcome });
    }
}
