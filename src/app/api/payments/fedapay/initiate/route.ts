import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { logger } from "@/lib/utils/logger";
import { ensureSchoolAccess } from "@/lib/api/tenant-isolation";
import { checkRateLimit, strictLimiter } from "@/lib/rate-limit";
import { createAccountCheckout } from "@/lib/payments/fedapay-account-client";
import { ONLINE_UNAVAILABLE_MESSAGE, resolveCollectingAccount } from "@/lib/payments/school-accounts";
import { livePaymentsGuard } from "@/lib/payments/live-mode";
import { ServiceUnavailableError, onlinePaymentPausedResponse } from "@/lib/resilience/errors";
import { ONLINE_PAYMENT_TTL_MS, startedAttemptConflict } from "@/lib/finance/online-payments";
import { INIT_UNCERTAIN_NOTE, ProviderInitError } from "@/lib/finance/providers/init-error";
import { appendNote } from "@/lib/finance/helpers";

const bodySchema = z.object({ paymentId: z.string().cuid() });

const STAFF = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"];

/**
 * POST /api/payments/fedapay/initiate — démarre un paiement FedaPay.
 *
 * Crée une transaction FedaPay pour un `Payment` PENDING et renvoie l'URL de
 * paiement hébergée. Le rapprochement final se fait via le webhook (signé).
 */
export const POST = createApiHandler(async (request, context) => {
    const session = context.session;

    // Règle 11 : une configuration d'argent réel non autorisée est refusée
    // avant tout appel au fournisseur, session et paiement même valides.
    const liveBlocked = livePaymentsGuard();
    if (liveBlocked) return liveBlocked;

    const rate = await checkRateLimit(strictLimiter, `fedapay-initiate:${session.user.id}`);
    if (!rate.success) {
        return NextResponse.json({ error: "Trop de tentatives. Réessayez." }, { status: 429 });
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
        return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }

    const payment = await prisma.payment.findUnique({
        where: { id: parsed.data.paymentId },
        select: {
            id: true,
            amount: true,
            status: true,
            reference: true,
            notes: true,
            provider: true,
            createdAt: true,
            studentId: true,
            student: { select: { schoolId: true } },
            fee: { select: { name: true, schoolId: true } },
        },
    });

    if (!payment) {
        return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
    }

    const accessError = ensureSchoolAccess(session, payment.student.schoolId);
    if (accessError) return accessError;

    if (!STAFF.includes(session.user.role)) {
        if (session.user.role !== "PARENT") {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }
        const parent = await prisma.parentProfile.findUnique({
            where: { userId: session.user.id },
            select: { parentStudents: { select: { studentId: true } } },
        });
        const childIds = parent?.parentStudents.map((c) => c.studentId) ?? [];
        if (!childIds.includes(payment.studentId)) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }
    }

    if (payment.status !== "PENDING") {
        return NextResponse.json(
            { error: "Ce paiement n'est pas en attente.", status: payment.status },
            { status: 409 }
        );
    }

    // Un essai de plus de 24 h ne réserve plus rien : il ne peut pas être relancé
    if (Date.now() - payment.createdAt.getTime() > ONLINE_PAYMENT_TTL_MS) {
        return NextResponse.json(
            { error: "Cette demande de paiement a expiré. Créez-en une nouvelle.", code: "PAYMENT_EXPIRED" },
            { status: 409 }
        );
    }

    // Essai déjà confié à un fournisseur (création incertaine comprise) : ni
    // repris chez FedaPay s'il est ailleurs, ni recréé chez FedaPay (S3)
    const started = startedAttemptConflict(payment, "FEDAPAY");
    if (started) return NextResponse.json({ error: started.error, code: started.code }, { status: started.status });

    const amount = Number(payment.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
    }

    const payer = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { firstName: true, lastName: true, email: true },
    });
    if (!payer?.email) {
        return NextResponse.json(
            { error: "Email du payeur requis pour le paiement en ligne." },
            { status: 400 }
        );
    }

    // Compte marchand de l'école du frais (S7) : sans compte actif et valide,
    // paiement en ligne indisponible pour cette école, aucune écriture.
    const resolved = await resolveCollectingAccount(prisma, payment.fee.schoolId);
    if (!resolved.ok) {
        logger.warn("Paiement en ligne indisponible pour l'école", { schoolId: payment.fee.schoolId, reason: resolved.reason });
        return NextResponse.json({ error: ONLINE_UNAVAILABLE_MESSAGE, code: "ONLINE_PAYMENT_UNAVAILABLE" }, { status: 503 });
    }

    const reference = payment.reference ?? `EDU-${payment.id}`;
    // Adresse publique configurée, comme /api/payments/initiate : jamais l'en-tête
    // Host de la requête (adresse interne derrière un proxy, ou falsifiable)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    try {
        // Référence enregistrée AVANT la création chez FedaPay : si le
        // processus s'arrête juste après, le webhook (merchant_reference)
        // retrouve quand même le paiement. Référence déterministe et paiement
        // toujours PENDING : sans effet si l'appel échoue.
        // Prise conditionnelle : seul un paiement encore confié à aucun
        // fournisseur est attribué à FedaPay (deux appels simultanés : un seul gagne)
        const claimed = await prisma.payment.updateMany({
            where: { id: payment.id, status: "PENDING", provider: null },
            data: { reference, method: "MOBILE_MONEY_MTN", provider: "FEDAPAY", paymentAccountId: resolved.account.id },
        });
        if (claimed.count !== 1) {
            const now = await prisma.payment.findUnique({ where: { id: payment.id }, select: { provider: true, notes: true } });
            const conflict = (now && startedAttemptConflict(now, "FEDAPAY")) ?? {
                status: 409 as const, code: "PAYMENT_ALREADY_STARTED" as const, error: "Ce paiement n'est plus en attente.",
            };
            return NextResponse.json({ error: conflict.error, code: conflict.code }, { status: conflict.status });
        }

        const checkout = await createAccountCheckout(resolved.credentials, {
            amount,
            description: payment.fee?.name ? `Frais : ${payment.fee.name}` : "Frais scolaires",
            reference,
            callbackUrl: `${appUrl}/dashboard/finance/retour-paiement?ref=${encodeURIComponent(reference)}`,
            customer: {
                firstname: payer.firstName ?? "Parent",
                lastname: payer.lastName ?? "EduPilot",
                email: payer.email,
            },
        });

        await prisma.payment.update({
            where: { id: payment.id },
            data: { providerTransactionId: checkout.transactionId },
        });

        logger.info("FedaPay: transaction initiée", {
            paymentId: payment.id,
            reference,
            fedapayId: checkout.transactionId,
        });

        return NextResponse.json({ url: checkout.url, reference });
    } catch (error) {
        if (error instanceof ServiceUnavailableError) return onlinePaymentPausedResponse(error);
        if (error instanceof ProviderInitError && error.cause instanceof ServiceUnavailableError) {
            return onlinePaymentPausedResponse(error.cause);
        }
        // Le paiement reste PENDING (réservé). Résultat inconnu : la transaction a
        // pu être créée — identifiant conservé s'il est connu, essai repéré (lot 3b)
        if (!(error instanceof ProviderInitError && error.outcome === "REFUSED")) {
            const providerTransactionId = error instanceof ProviderInitError ? error.providerTransactionId : undefined;
            const current = await prisma.payment.findUnique({ where: { id: payment.id }, select: { notes: true } });
            await prisma.payment.updateMany({
                where: { id: payment.id, status: "PENDING" },
                data: {
                    notes: current?.notes?.includes(INIT_UNCERTAIN_NOTE) ? current.notes : appendNote(current?.notes ?? null, INIT_UNCERTAIN_NOTE),
                    ...(providerTransactionId ? { providerTransactionId } : {}),
                },
            });
        }
        logger.error("FedaPay initiate error", error as Error, {
            module: "api/payments/fedapay/initiate",
        });
        return NextResponse.json(
            { error: "Échec de l'initialisation du paiement. Réessayez." },
            { status: 502 }
        );
    }
});
