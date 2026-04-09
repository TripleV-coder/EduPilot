import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PaymentProviderFactory } from "@/lib/finance/factory";
import { SupportedProvider } from "@/lib/finance/types";
import { logger } from "@/lib/utils/logger";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { z } from "zod";
import { nanoid } from "nanoid";

const initiateSchema = z.object({
    amount: z.union([z.number(), z.string()]).transform(val => Number(val)),
    currency: z.string().optional(),
    feeId: z.string(),
    studentId: z.string(),
    provider: z.string()
});

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. RBAC check
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "PARENT", "STUDENT"].includes(session.user.role)) {
        return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    // 2FA check explicitly on API level for sensitive routes
    if (session.user.isTwoFactorEnabled && !session.user.isTwoFactorAuthenticated) {
        return NextResponse.json({ error: "2FA authentication required" }, { status: 403 });
    }

    try {
        const body = await req.json();

        // 2. Validation
        const parsed = initiateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid request data", details: parsed.error.format() }, { status: 400 });
        }

        const { amount, currency, feeId, studentId, provider } = parsed.data;
        // 3. Multi-tenant Check
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

        // 4. Amount Integrity Check
        if (amount <= 0 || amount > Number(fee.amount)) {
            return NextResponse.json({ error: `Montant invalide. Le maximum autorisé est ${fee.amount}` }, { status: 400 });
        }

        // --- ATOMIC IDEMPOTENCY & CREATION ---
        const newMethod = provider === "MOOV" ? "MOBILE_MONEY_MOOV" : "MOBILE_MONEY_MTN";

        const paymentRecord = await prisma.$transaction(async (tx) => {
            // Check for existing pending payment within the transaction
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
                    // Update method if provider changed
                    return await tx.payment.update({
                        where: { id: existing.id },
                        data: { method: newMethod }
                    });
                }
                return existing;
            }

            // Create new record if none exists
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

        const isIdempotent = paymentRecord.createdAt.getTime() < Date.now() - 1000; // Rough check if it was just created
        if (isIdempotent) {
            logger.info("Payment idempotency hit — returning/refreshing pending payment", {
                paymentId: paymentRecord.id,
                studentId,
                feeId
            });
        }

        // 2. Initiate with Provider
        const paymentProvider = PaymentProviderFactory.getProvider(provider as SupportedProvider);
        const result = await paymentProvider.initiatePayment(
            Number(paymentRecord.amount), // SECURITY: Use the record amount, not the request amount
            currency || 'XOF',
            session.user.email!,
            paymentRecord.reference!,
            { paymentId: paymentRecord.id }
        );

        // 3. Update with Provider reference if returned as transactionId
        if (result.transactionId) {
            await prisma.payment.update({
                where: { id: paymentRecord.id },
                data: { reference: result.transactionId } // Using reference since transactionId is not in model
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
}
