import { publicBaseUrl } from "@/lib/system/platform";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { createAccountCheckout } from "@/lib/payments/fedapay-account-client";
import { ONLINE_UNAVAILABLE_MESSAGE, SCHOOL_PAYMENT_PROVIDER, resolveCollectingAccount } from "@/lib/payments/school-accounts";
import { logger } from "@/lib/utils/logger";
import { ServiceUnavailableError, onlinePaymentPausedResponse } from "@/lib/resilience/errors";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { superAdminTargetOutOfScope } from "@/lib/finance/finance-scope";
import { z } from "zod";
import { fcfaAmountSchema } from "@/lib/finance/money";
import { randomId } from "@/lib/utils/random-id";
import { EXPECTED_CURRENCY, getFeeBalance, lockStudentFee, startedAttemptConflict } from "@/lib/finance/online-payments";
import { INIT_UNCERTAIN_NOTE, ProviderInitError } from "@/lib/finance/providers/init-error";
import { appendNote } from "@/lib/finance/helpers";
import { currentPlanInstallments, intentAmount, isFeeApplicableToStudent } from "@/lib/finance/family-finance";

const initiateSchema = z.object({
    // FCFA entiers, strictement positifs (avant : NaN et centimes passaient).
    // Exigé pour un montant libre ; ignoré pour une intention calculée.
    amount: fcfaAmountSchema.optional(),
    /**
     * Intention du payeur (parcours parent) : montant libre, prochaine
     * échéance ou tout le solde disponible. Pour les deux dernières, le montant
     * est recalculé par le serveur sous verrou, jamais lu dans la requête.
     */
    mode: z.enum(["AMOUNT", "NEXT_INSTALLMENT", "FULL_BALANCE"]).default("AMOUNT"),
    // Seul le franc CFA est accepté : un autre code est refusé, jamais converti
    currency: z.literal(EXPECTED_CURRENCY).optional(),
    feeId: z.string(),
    studentId: z.string(),
    provider: z.string(),
    /** Numéro du payeur (requis pour MoMo direct requestToPay). */
    payerPhone: z.string().optional(),
});

/**
 * Rail de paiement d'une école (S7, ADR-0011) : FedaPay, sur le compte
 * marchand de l'école, couvre les réseaux Mobile Money (MTN, Moov, Celtiis).
 * MoMo direct, Flutterwave et Paystack n'existent qu'en configuration globale
 * (un compte de la plateforme) : refusés pour les paiements des écoles.
 */
function resolveProvider(requested: string): typeof SCHOOL_PAYMENT_PROVIDER | null {
    const r = requested.toUpperCase();
    return r === "MTN" || r === "MOOV" || r === "MOBILE_MONEY" || r === "FEDAPAY" ? SCHOOL_PAYMENT_PROVIDER : null;
}

const onlineUnavailable = () =>
    NextResponse.json({ error: ONLINE_UNAVAILABLE_MESSAGE, code: "ONLINE_PAYMENT_UNAVAILABLE" }, { status: 503 });

function splitName(full: string | undefined): { firstname: string; lastname: string } {
    const parts = (full || "EduPilot Élève").trim().split(/\s+/);
    if (parts.length === 1) return { firstname: parts[0], lastname: "—" };
    return { firstname: parts[0], lastname: parts.slice(1).join(" ") };
}

export const POST = createApiHandler(
    async (request, context) => {
        const session = context.session;

        try {
            const body = await request.json();

            const parsed = initiateSchema.safeParse(body);
            if (!parsed.success) {
                return NextResponse.json({ error: "Données de requête invalides", details: parsed.error.format() }, { status: 400 });
            }

            const { amount: requestedAmount, mode, feeId, studentId, provider, payerPhone } = parsed.data;
            if (mode === "AMOUNT" && requestedAmount === undefined) {
                return NextResponse.json({ error: "Montant requis", code: "AMOUNT_REQUIRED" }, { status: 400 });
            }
            const resolvedProvider = resolveProvider(provider);
            // Avant toute écriture : pas de paiement « en attente » orphelin.
            if (!resolvedProvider) return onlineUnavailable();

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
                return NextResponse.json({ error: "Cet élève ne relève pas de votre établissement." }, { status: 403 });
            }

            // Intégrité (lot 3f) : un parent d'enfants dans deux écoles ne peut
            // pas payer le frais de l'une pour l'enfant de l'autre
            if (fee.schoolId !== studentProfile.schoolId) {
                return NextResponse.json({ error: "Les frais n'appartiennent pas à l'établissement de l'élève." }, { status: 403 });
            }
            const outOfScope = await superAdminTargetOutOfScope(session, fee.schoolId, "payments:initiate");
            if (outOfScope) return outOfScope;

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
                    return NextResponse.json({ error: "Cet élève n'est pas rattaché à votre compte parent." }, { status: 403 });
                }
            }

            if (session.user.role === "STUDENT" && studentProfile.userId !== session.user.id) {
                return NextResponse.json({ error: "Vous ne pouvez payer que pour votre propre compte." }, { status: 403 });
            }

            // Famille : seulement un frais qui concerne l'enfant (son année, son
            // niveau, facultatif souscrit) — l'identifiant envoyé ne prouve rien
            if (
                (session.user.role === "PARENT" || session.user.role === "STUDENT") &&
                !(await isFeeApplicableToStudent(prisma, studentId, feeId))
            ) {
                return NextResponse.json(
                    { error: "Ces frais ne concernent pas cet élève pour l'année en cours.", code: "FEE_NOT_APPLICABLE" },
                    { status: 409 },
                );
            }

            // Compte marchand de l'école du frais (jamais une valeur du navigateur),
            // actif et déchiffrable dans l'environnement autorisé. Aucun repli.
            const resolved = await resolveCollectingAccount(prisma, fee.schoolId);
            if (!resolved.ok) {
                logger.warn("Paiement en ligne indisponible pour l'école", { schoolId: fee.schoolId, reason: resolved.reason });
                return onlineUnavailable();
            }

            const newMethod = provider === "MOOV" ? "MOBILE_MONEY_MOOV" : "MOBILE_MONEY_MTN";

            // Verrou par élève et par frais : deux demandes simultanées ne
            // peuvent pas réserver deux fois le même reste à payer.
            const outcome = await prisma.$transaction(async (tx) => {
                await lockStudentFee(tx, studentId, feeId);

                // Intention calculée : montant relu sous le verrou, au moment de l'essai
                let amount: number;
                if (mode === "AMOUNT") {
                    amount = requestedAmount!;
                } else {
                    const current = await getFeeBalance(tx, studentId, feeId);
                    if (!current) return { kind: "refused" as const, balance: null, amount: 0 };
                    const plan = mode === "NEXT_INSTALLMENT" ? await currentPlanInstallments(tx, studentId, feeId) : null;
                    const intent = intentAmount(mode, current, plan?.installmentPayments ?? null);
                    if ("error" in intent) return { kind: "intent" as const, error: intent.error, balance: current };
                    amount = intent.amount;
                }

                // Même demande répétée (double clic, retour arrière, autre opérateur) :
                // l'essai en cours n'est ni modifié ni renvoyé (S3) — même
                // fournisseur, ce serait une seconde transaction ; autre
                // fournisseur, celui d'origine peut encore le confirmer
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                const existing = await tx.payment.findFirst({
                    where: { studentId, feeId, amount, status: "PENDING", provider: { not: null }, createdAt: { gte: fiveMinutesAgo } },
                    orderBy: { createdAt: "desc" },
                    select: { id: true, provider: true, notes: true },
                });
                const conflict = existing ? startedAttemptConflict(existing, resolvedProvider) : null;
                if (existing && conflict) return { kind: "started" as const, conflict, paymentId: existing.id };

                // Reste à payer : échéancier (bourses déduites) sinon frais, moins
                // l'encaissé et les essais en ligne encore en attente
                const balance = await getFeeBalance(tx, studentId, feeId);
                if (!balance || amount > balance.available) return { kind: "refused" as const, balance, amount };

                const payment = await tx.payment.create({
                    data: {
                        amount,
                        method: newMethod,
                        feeId,
                        studentId,
                        status: "PENDING",
                        provider: resolvedProvider,
                        paymentAccountId: resolved.account.id,
                        reference: `PAY-${Date.now()}-${randomId(6).toUpperCase()}`,
                    },
                });
                return { kind: "attempt" as const, payment };
            });

            if (outcome.kind === "started") {
                logger.info("Paiement en ligne : essai déjà lancé, ni modifié ni renvoyé", {
                    paymentId: outcome.paymentId,
                    requestedProvider: resolvedProvider,
                    code: outcome.conflict.code,
                });
                return NextResponse.json(
                    { error: outcome.conflict.error, code: outcome.conflict.code, paymentId: outcome.paymentId },
                    { status: outcome.conflict.status },
                );
            }

            if (outcome.kind === "intent") {
                const balance = outcome.balance;
                const messages = {
                    PAYMENT_IN_PROGRESS: `Un paiement en ligne de ${balance.reserved} FCFA attend la confirmation du fournisseur pour ces frais. Attendez son résultat avant de régler une échéance ou le solde.`,
                    NOTHING_DUE: "Rien n'est à régler sur ces frais pour le moment.",
                    NO_INSTALLMENT_DUE: "Aucune échéance n'est à régler sur ces frais.",
                } as const;
                return NextResponse.json(
                    { error: messages[outcome.error], code: outcome.error, remaining: balance.remaining, reserved: balance.reserved, available: balance.available },
                    { status: 409 },
                );
            }

            if (outcome.kind === "refused") {
                const balance = outcome.balance;
                const amount = outcome.amount;
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

            let result: { paymentUrl: string; transactionId: string };
            try {
                const appUrl = (publicBaseUrl() ?? "http://localhost:3000");
                const checkout = await createAccountCheckout(resolved.credentials, {
                    amount: Number(paymentRecord.amount),
                    description: "Frais scolaires",
                    reference: paymentRecord.reference!,
                    // Retour du navigateur : page qui lit le statut en base (S4), jamais une API
                    callbackUrl: `${appUrl}/dashboard/finance/retour-paiement?ref=${encodeURIComponent(paymentRecord.reference!)}`,
                    customer: { ...splitName(undefined), email: session.user.email!, phone: payerPhone || undefined },
                });
                result = { paymentUrl: checkout.url, transactionId: checkout.transactionId };
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
                paymentId: paymentRecord.id,
                // Suivi de l'essai par la page de retour (statut lu en base, S4)
                reference: paymentRecord.reference,
                amount: Math.round(Number(paymentRecord.amount)),
            });

        } catch (error) {
            if (error instanceof ServiceUnavailableError) return onlinePaymentPausedResponse(error);
            logger.error("Payment initiation failed", error instanceof Error ? error : new Error(String(error)), { module: "api/payments/initiate" });
            return NextResponse.json({ error: "Le paiement n'a pas pu être préparé. Réessayez plus tard ou réglez à l'économat." }, { status: 500 });
        }
    },
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "PARENT", "STUDENT"] }
);
