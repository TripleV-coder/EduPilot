import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { verifyPendingPayment, type ManualVerifyOutcome } from "@/lib/finance/online-payments";
import { verifyOnSchoolAccount } from "@/lib/payments/school-accounts";
import { createAuditLog } from "@/lib/security/audit-log";

/**
 * POST /api/payments/<id>/verify-provider — TD-025 (décision du 2026-10-25 :
 * rapprochement manuel prouvé, par l'école).
 *
 * Le comptable ou l'administration de l'école interroge le fournisseur, sur le
 * compte marchand de SON école, au sujet d'un paiement en ligne resté en
 * attente. Aucune libération arbitraire : le paiement n'est validé ou annulé
 * que sur réponse définitive et conforme du fournisseur (verifyPendingPayment).
 * Justification obligatoire, note datée sur le paiement et journal d'audit.
 */
const bodySchema = z.object({
    justification: z
        .string()
        .trim()
        .min(10, "Indiquez le motif de la vérification (au moins 10 caractères).")
        .max(500, "Le motif ne doit pas dépasser 500 caractères."),
});

const NOT_VERIFIABLE: Record<Extract<ManualVerifyOutcome, { outcome: "NOT_VERIFIABLE" }>["reason"], string> = {
    NOT_FOUND: "Paiement introuvable.",
    NOT_PENDING: "Ce paiement n'est plus en attente : rien à vérifier.",
    NOT_ONLINE: "Ce paiement n'est pas un paiement en ligne.",
    LEGACY_ACCOUNT:
        "Ce paiement relève de l'ancienne configuration de paiement, sans compte marchand d'école : il ne peut pas être vérifié ici. Le montant reste réservé ; rapprochez-le avec le relevé du fournisseur.",
    NO_TRANSACTION_ID:
        "Le fournisseur n'a jamais renvoyé d'identifiant de transaction : il ne peut pas être interrogé. Le montant reste réservé ; vérifiez dans l'espace FedaPay de l'école avant tout encaissement de ce montant.",
};

const STILL_PENDING: Record<Extract<ManualVerifyOutcome, { outcome: "STILL_PENDING" }>["reason"], string> = {
    PROVIDER_PENDING: "Le fournisseur indique que le paiement est toujours en attente. Rien n'a changé ; le montant reste réservé.",
    PROVIDER_UNREACHABLE: "Le fournisseur n'a pas pu être joint. Rien n'a changé ; réessayez plus tard.",
    MISMATCH: "Le fournisseur indique un paiement dont le montant ou la devise ne correspondent pas. Le paiement reste en attente, à rapprocher.",
    BLOCKED: "La validation est bloquée par une incohérence du plan de paiement. Le paiement reste en attente, à examiner.",
    REJECTED: "La réponse du fournisseur ne correspond pas à ce paiement. Le paiement reste en attente, à examiner.",
    VALIDATION_ERROR: "Le fournisseur indique un paiement réussi, mais la validation a échoué. Rien n'a changé ; réessayez.",
};

export const POST = createApiHandler(
    async (request, { session, params }) => {
        const { id } = await params;
        const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
        }

        // Périmètre : un paiement d'une autre école n'existe pas pour l'appelant
        const payment = typeof id === "string"
            ? await prisma.payment.findUnique({ where: { id }, select: { id: true, student: { select: { schoolId: true } } } })
            : null;
        if (!payment || !canAccessSchool(session, payment.student.schoolId)) {
            return NextResponse.json({ error: NOT_VERIFIABLE.NOT_FOUND }, { status: 404 });
        }

        const actorLabel = `${session.user.firstName ?? ""} ${session.user.lastName ?? ""}`.trim() || session.user.id;
        const result = await verifyPendingPayment(
            payment.id,
            (_provider, transactionId, paymentAccountId) => verifyOnSchoolAccount(paymentAccountId as string, transactionId),
            { id: session.user.id, label: actorLabel },
            parsed.data.justification,
        );

        await createAuditLog({
            userId: session.user.id,
            action: "PAYMENT_PROVIDER_VERIFY",
            entity: "Payment",
            entityId: payment.id,
            schoolId: payment.student.schoolId,
            newValues: { ...result, justification: parsed.data.justification },
            severity: "WARNING",
        });

        switch (result.outcome) {
            case "CONFIRMED":
            case "ALREADY_PROCESSED":
                return NextResponse.json({ ...result, message: "Paiement confirmé par le fournisseur : il est validé." });
            case "CANCELLED":
                return NextResponse.json({ ...result, message: "Échec définitif chez le fournisseur : le paiement est annulé et son montant n'est plus réservé." });
            case "STILL_PENDING":
                return NextResponse.json(
                    { ...result, message: STILL_PENDING[result.reason] },
                    { status: result.reason === "PROVIDER_UNREACHABLE" ? 503 : 200 },
                );
            case "NOT_VERIFIABLE":
                return NextResponse.json(
                    { ...result, error: NOT_VERIFIABLE[result.reason] },
                    { status: result.reason === "NOT_FOUND" ? 404 : 409 },
                );
        }
    },
    // École seulement (décision TD-025) : NETWORK_ADMIN hérite de SCHOOL_ADMIN
    { allowedRoles: ["SCHOOL_ADMIN", "ACCOUNTANT"] },
);
