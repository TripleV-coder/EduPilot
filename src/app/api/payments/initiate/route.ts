import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { PaymentProviderFactory } from "@/lib/finance/factory";
import { SupportedProvider } from "@/lib/finance/types";
import { isMomoConfigured } from "@/lib/finance/providers/momo";
import { isFedaPayConfigured } from "@/lib/payments/fedapay";
import { logger } from "@/lib/utils/logger";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { z } from "zod";
import { nanoid } from "nanoid";

const initiateSchema = z.object({
    amount: z.union([z.number(), z.string()]).transform(val => Number(val)),
    currency: z.string().optional(),
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

export const POST = createApiHandler(
    async (request, context) => {
        const session = context.session;

        try {
            const body = await request.json();

            const parsed = initiateSchema.safeParse(body);
            if (!parsed.success) {
                return NextResponse.json({ error: "Invalid request data", details: parsed.error.format() }, { status: 400 });
            }

            const { amount, currency, feeId, studentId, provider, payerPhone } = parsed.data;
            const resolvedProvider = resolveProvider(provider);

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
                return NextResponse.json({ error: "Student not found" }, { status: 404 });
            }

            if (!fee) {
                return NextResponse.json({ error: "Fee not found" }, { status: 404 });
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

            if (amount <= 0 || amount > Number(fee.amount)) {
                return NextResponse.json({ error: `Montant invalide. Le maximum autorisé est ${fee.amount}` }, { status: 400 });
            }

            const newMethod = provider === "MOOV" ? "MOBILE_MONEY_MOOV" : "MOBILE_MONEY_MTN";

            const paymentRecord = await prisma.$transaction(async (tx) => {
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                const existing = await tx.payment.findFirst({
                    where: {
                        studentId,
                        feeId,
                        status: "PENDING",
                        createdAt: { gte: fiveMinutesAgo }
                    },
                    orderBy: { createdAt: "desc" }
                });

                if (existing) {
                    if (existing.method !== newMethod) {
                        return await tx.payment.update({
                            where: { id: existing.id },
                            data: { method: newMethod }
                        });
                    }
                    return existing;
                }

                return await tx.payment.create({
                    data: {
                        amount,
                        method: newMethod,
                        feeId,
                        studentId,
                        status: "PENDING",
                        reference: `PAY-${Date.now()}-${nanoid(6).toUpperCase()}`,
                    },
                });
            });

            const isIdempotent = paymentRecord.createdAt.getTime() < Date.now() - 1000;
            if (isIdempotent) {
                logger.info("Payment idempotency hit — returning/refreshing pending payment", {
                    paymentId: paymentRecord.id,
                    studentId,
                    feeId
                });
            }

            const paymentProvider = PaymentProviderFactory.getProvider(resolvedProvider);
            const result = await paymentProvider.initiatePayment(
                Number(paymentRecord.amount),
                currency || 'XOF',
                session.user.email!,
                paymentRecord.reference!,
                { paymentId: paymentRecord.id, phone: payerPhone, network: provider }
            );

            if (result.transactionId) {
                await prisma.payment.update({
                    where: { id: paymentRecord.id },
                    data: { reference: result.transactionId }
                });
            }

            return NextResponse.json({
                paymentUrl: result.paymentUrl,
                transactionId: result.transactionId,
                paymentId: paymentRecord.id
            });

        } catch (error) {
            logger.error("Payment initiation failed", error instanceof Error ? error : new Error(String(error)), { module: "api/payments/initiate" });
            return NextResponse.json({ error: "Payment initiation failed" }, { status: 500 });
        }
    },
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "PARENT", "STUDENT"] }
);
