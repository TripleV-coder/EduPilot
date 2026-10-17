import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { PaymentProviderFactory } from "@/lib/finance/factory";
import { SupportedProvider } from "@/lib/finance/types";
import { isMomoConfigured } from "@/lib/finance/providers/momo";
import { isFedaPayConfigured } from "@/lib/payments/fedapay";
import { livePaymentsGuard } from "@/lib/payments/live-mode";
import { logger } from "@/lib/utils/logger";
import { ServiceUnavailableError, serviceUnavailableResponse } from "@/lib/resilience/errors";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { z } from "zod";
import { fcfaAmountSchema } from "@/lib/finance/money";
import { nanoid } from "nanoid";
import { EXPECTED_CURRENCY, getFeeBalance, lockStudentFee } from "@/lib/finance/online-payments";
import { INIT_UNCERTAIN_NOTE, ProviderInitError } from "@/lib/finance/providers/init-error";
import { appendNote } from "@/lib/finance/helpers";

const initiateSchema = z.object({
    // FCFA entiers, strictement positifs (avant : NaN et centimes passaient)
    amount: fcfaAmountSchema,
    // Seul le franc CFA est accepté : un autre code est refusé, jamais converti
    currency: z.literal(EXPECTED_CURRENCY).optional(),
    feeId: z.string(),
    studentId: z.string(),
    provider: z.string(),
    /** Numéro du payeur (requis pour MoMo direct requestToPay). */
    payerPhone: z.string().optional(),
});

/**
 * Résout le rail de paiement effectif. Les réseaux Mobile Money (MTN/Moov)
 * passent par MoMo direct si l'école a configuré l'API MTN, sinon par FedaPay
 * (agrégateur qui couvre MTN/Moov/Celtiis). Les autres providers sont honorés
 * tels quels.
 */
function resolveProvider(requested: string): SupportedProvider {
    const r = requested.toUpperCase();
    if (r === "MTN" || r === "MOOV" || r === "MOBILE_MONEY") {
        if (isMomoConfigured()) return "MOMO";
        if (isFedaPayConfigured()) return "FEDAPAY";
        return "FEDAPAY";
    }
    return r as SupportedProvider;
}

/** Rails en ligne dont les identifiants serveur sont requis pour initier un paiement. */
function isRailConfigured(provider: SupportedProvider): boolean {
    if (provider === "MOMO") return isMomoConfigured();
    if (provider === "FEDAPAY") return isFedaPayConfigured();
    return true;
}

export const POST = createApiHandler(
    async (request, context) => {
        const session = context.session;

        // Règle 11 : une configuration d'argent réel non autorisée est refusée
        // avant tout appel au fournisseur.
        const liveBlocked = livePaymentsGuard();
        if (liveBlocked) return liveBlocked;

        try {
            const body = await request.json();

            const parsed = initiateSchema.safeParse(body);
            if (!parsed.success) {
                return NextResponse.json({ error: "Données de requête invalides", details: parsed.error.format() }, { status: 400 });
            }

            const { amount, feeId, studentId, provider, payerPhone } = parsed.data;
            const resolvedProvider = resolveProvider(provider);
            if (!isRailConfigured(resolvedProvider)) {
                // Avant toute écriture : pas de paiement « en attente » orphelin.
                return NextResponse.json(
                    {
                        error:
                            "Le paiement Mobile Money en ligne n'est pas configuré. Pour un transfert déjà reçu, enregistrez-le avec sa référence de transaction.",
                        code: "PAYMENT_GATEWAY_NOT_CONFIGURED",
                    },
                    { status: 503 }
                );
            }

            const [studentProfile, fee] = await Promise.all([
                prisma.studentProfile.findUnique({
                    where: { id: studentId },
                    select: { id: true, schoolId: true, userId: true }
                }),
                prisma.fee.findUnique({
                    where: { id: feeId },
                    select: { id: true, schoolId: true, amount: true }
                }),
            ]);

            if (!studentProfile) {
                return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });
            }

            if (!fee) {
                return NextResponse.json({ error: "Frais introuvables" }, { status: 404 });
            }

            if (
                session.user.role !== "SUPER_ADMIN" &&
                (
                    !canAccessSchool(session, studentProfile.schoolId) ||
                    !canAccessSchool(session, fee.schoolId)
                )
            ) {
                return NextResponse.json({ error: "Forbidden: cross-tenant access denied" }, { status: 403 });
            }

            // Intégrité (lot 3f) : un parent d'enfants dans deux écoles ne peut
            // pas payer le frais de l'une pour l'enfant de l'autre
            if (fee.schoolId !== studentProfile.schoolId) {
                return NextResponse.json({ error: "Les frais n'appartiennent pas à l'établissement de l'élève." }, { status: 403 });
            }

            if (session.user.role === "PARENT") {
                const parentProfile = await prisma.parentProfile.findUnique({
                    where: { userId: session.user.id },
                    select: {
                        parentStudents: {
                            select: { studentId: true },
                        },
                    },
                });

                const childrenIds = parentProfile?.parentStudents.map((child) => child.studentId) ?? [];
                if (!childrenIds.includes(studentId)) {
                    return NextResponse.json({ error: "Forbidden: not your child" }, { status: 403 });
                }
            }

            if (session.user.role === "STUDENT" && studentProfile.userId !== session.user.id) {
                return NextResponse.json({ error: "Forbidden: you can only pay for your own account" }, { status: 403 });
            }

            const newMethod = provider === "MOOV" ? "MOBILE_MONEY_MOOV" : "MOBILE_MONEY_MTN";

            // Verrou par élève et par frais : deux demandes simultanées ne
            // peuvent pas réserver deux fois le même reste à payer.
            const outcome = await prisma.$transaction(async (tx) => {
                await lockStudentFee(tx, studentId, feeId);

                // Même demande répétée (double clic, retour arrière) : on reprend l'essai en cours
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                const existing = await tx.payment.findFirst({
                    where: { studentId, feeId, amount, status: "PENDING", createdAt: { gte: fiveMinutesAgo } },
                    orderBy: { createdAt: "desc" },
                });
                if (existing) {
                    const payment = await tx.payment.update({
                        where: { id: existing.id },
                        data: { method: newMethod, provider: resolvedProvider },
                    });
                    return { kind: "attempt" as const, payment, created: false };
                }

                // Reste à payer : échéancier (bourses déduites) sinon frais, moins
                // l'encaissé et les essais en ligne encore en attente
                const balance = await getFeeBalance(tx, studentId, feeId);
                if (!balance || amount > balance.available) return { kind: "refused" as const, balance };

                const payment = await tx.payment.create({
                    data: {
                        amount,
                        method: newMethod,
                        feeId,
                        studentId,
                        status: "PENDING",
                        provider: resolvedProvider,
                        reference: `PAY-${Date.now()}-${nanoid(6).toUpperCase()}`,
                    },
                });
                return { kind: "attempt" as const, payment, created: true };
            });

            if (outcome.kind === "refused") {
                const balance = outcome.balance;
                if (!balance) return NextResponse.json({ error: "Frais introuvables" }, { status: 404 });
                if (balance.reserved > 0 && amount <= balance.remaining) {
                    return NextResponse.json(
                        {
                            error: `Un paiement en ligne de ${balance.reserved} FCFA est déjà en attente de confirmation pour ces frais. Montant payable maintenant : ${balance.available} FCFA. L'essai en attente est libéré dès que le fournisseur confirme son échec, ou lors de la réconciliation après 24 h sans réponse.`,
                            code: "PAYMENT_IN_PROGRESS",
                            remaining: balance.remaining,
                            reserved: balance.reserved,
                            available: balance.available,
                        },
                        { status: 409 }
                    );
                }
                return NextResponse.json(
                    { error: `Montant invalide. Le reste à payer est de ${balance.remaining} FCFA.`, remaining: balance.remaining },
                    { status: 400 }
                );
            }
            const paymentRecord = outcome.payment;

            if (!outcome.created) {
                logger.info("Payment idempotency hit — returning/refreshing pending payment", {
                    paymentId: paymentRecord.id,
                    studentId,
                    feeId
                });
                // Création incertaine chez le fournisseur : le rappeler pourrait
                // créer une seconde transaction pour la même dette (lot 3b)
                if (paymentRecord.notes?.includes(INIT_UNCERTAIN_NOTE)) {
                    return NextResponse.json(
                        {
                            error: "Un paiement en ligne de ce montant est en cours de vérification chez le fournisseur. Ne le relancez pas : il sera confirmé ou libéré automatiquement.",
                            code: "PAYMENT_INIT_UNCERTAIN",
                            paymentId: paymentRecord.id,
                        },
                        { status: 409 }
                    );
                }
            }

            const paymentProvider = PaymentProviderFactory.getProvider(resolvedProvider);
            let result: { paymentUrl: string; transactionId: string };
            try {
                result = await paymentProvider.initiatePayment(
                    Number(paymentRecord.amount),
                    EXPECTED_CURRENCY,
                    session.user.email!,
                    paymentRecord.reference!,
                    { paymentId: paymentRecord.id, phone: payerPhone, network: provider }
                );
            } catch (error) {
                // Demande jamais transmise au fournisseur (prouvé par le code) : aucune
                // transaction n'existe, l'essai cesse de réserver (EXPIRED, toujours
                // rapprochable). Toute autre erreur, réponse 4xx comprise, laisse un
                // résultat INCONNU : l'essai reste PENDING et réservé (lot 3b).
                const refused = error instanceof ProviderInitError && error.outcome === "REFUSED";
                if (refused) {
                    await prisma.payment.updateMany({
                        where: { id: paymentRecord.id, status: "PENDING" },
                        data: {
                            status: "EXPIRED",
                            notes: appendNote(paymentRecord.notes, "Demande jamais transmise au fournisseur : aucune transaction créée."),
                        },
                    });
                    // Circuit ouvert : « service momentanément indisponible » (503)
                    throw error.cause instanceof ServiceUnavailableError ? error.cause : error;
                }
                const providerTransactionId = error instanceof ProviderInitError ? error.providerTransactionId : undefined;
                await prisma.payment.updateMany({
                    where: { id: paymentRecord.id, status: "PENDING" },
                    data: {
                        notes: appendNote(paymentRecord.notes, INIT_UNCERTAIN_NOTE),
                        ...(providerTransactionId ? { providerTransactionId } : {}),
                    },
                });
                logger.warn("Initialisation du paiement en ligne : résultat inconnu, essai conservé en attente", {
                    paymentId: paymentRecord.id,
                    provider: resolvedProvider,
                    providerTransactionId: providerTransactionId ?? null,
                    reason: (error as Error).message,
                });
                return NextResponse.json(
                    {
                        error: "Le fournisseur n'a pas confirmé la création du paiement. Ne le relancez pas : il sera vérifié automatiquement, puis confirmé ou libéré.",
                        code: "PAYMENT_INIT_UNCERTAIN",
                        paymentId: paymentRecord.id,
                    },
                    { status: 502 }
                );
            }

            await prisma.payment.update({
                where: { id: paymentRecord.id },
                data: { providerTransactionId: result.transactionId },
            });

            // N7 : `reference` est NOTRE clé de rapprochement, transmise au
            // fournisseur (MoMo externalId, FedaPay merchant_reference) et
            // renvoyée par ses webhooks. Elle ne doit jamais être remplacée par
            // l'identifiant du fournisseur — sinon le paiement devient
            // introuvable et reste PENDING. Elle est déjà en base avant l'appel
            // (transaction ci-dessus) : un arrêt brutal ici ne perd rien.
            logger.info("Paiement initié chez le fournisseur", {
                paymentId: paymentRecord.id,
                reference: paymentRecord.reference,
                provider: resolvedProvider,
                providerTransactionId: result.transactionId,
            });

            return NextResponse.json({
                paymentUrl: result.paymentUrl,
                transactionId: result.transactionId,
                paymentId: paymentRecord.id
            });

        } catch (error) {
            if (error instanceof ServiceUnavailableError) return serviceUnavailableResponse(error);
            logger.error("Payment initiation failed", error instanceof Error ? error : new Error(String(error)), { module: "api/payments/initiate" });
            return NextResponse.json({ error: "Payment initiation failed" }, { status: 500 });
        }
    },
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "PARENT", "STUDENT"] }
);
