import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { ensureSchoolAccess } from "@/lib/api/tenant-isolation";
import { checkRateLimit, strictLimiter } from "@/lib/rate-limit";
import { isFedaPayConfigured, createFedaPayCheckout } from "@/lib/payments/fedapay";

const bodySchema = z.object({ paymentId: z.string().cuid() });

const STAFF = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"];

/**
 * POST /api/payments/fedapay/initiate — démarre un paiement FedaPay.
 *
 * Crée une transaction FedaPay pour un `Payment` PENDING et renvoie l'URL de
 * paiement hébergée. Le rapprochement final se fait via le webhook (signé).
 */
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    if (!isFedaPayConfigured()) {
        return NextResponse.json(
            { error: "Paiement en ligne non configuré.", code: "FEDAPAY_NOT_CONFIGURED" },
            { status: 503 }
        );
    }

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
            studentId: true,
            student: { select: { schoolId: true } },
            fee: { select: { name: true } },
        },
    });

    if (!payment) {
        return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
    }

    // Isolation tenant
    const accessError = ensureSchoolAccess(session, payment.student.schoolId);
    if (accessError) return accessError;

    // Autorisation : staff, ou parent rattaché à l'élève
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

    const reference = payment.reference ?? `EDU-${payment.id}`;
    const origin = new URL(request.url).origin;

    try {
        const checkout = await createFedaPayCheckout({
            amount,
            description: payment.fee?.name ? `Frais : ${payment.fee.name}` : "Frais scolaires",
            reference,
            callbackUrl: `${origin}/dashboard/finance?ref=${encodeURIComponent(reference)}`,
            customer: {
                firstname: payer.firstName ?? "Parent",
                lastname: payer.lastName ?? "EduPilot",
                email: payer.email,
            },
        });

        // Marque le paiement comme FedaPay/MoMo + fige la référence de rapprochement
        await prisma.payment.update({
            where: { id: payment.id },
            data: { reference, method: "MOBILE_MONEY_MTN" },
        });

        logger.info("FedaPay: transaction initiée", {
            paymentId: payment.id,
            reference,
            fedapayId: checkout.transactionId,
        });

        return NextResponse.json({ url: checkout.url, reference });
    } catch (error) {
        logger.error("FedaPay initiate error", error as Error, {
            module: "api/payments/fedapay/initiate",
        });
        return NextResponse.json(
            { error: "Échec de l'initialisation du paiement. Réessayez." },
            { status: 502 }
        );
    }
}
