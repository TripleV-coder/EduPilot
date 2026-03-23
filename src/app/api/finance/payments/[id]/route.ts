import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { syncPaymentPlanLedger } from "@/lib/finance/helpers";
import { logger } from "@/lib/utils/logger";
import { z } from "zod";

const paymentUpdateSchema = z.object({
    amount: z.number().optional().or(z.preprocess(v => Number(v), z.number())),
    method: z.string().optional(),
    reference: z.string().optional(),
    status: z.enum(["PENDING", "COMPLETED", "FAILED", "CANCELLED", "VERIFIED", "RECONCILED"]).optional(),
    notes: z.string().optional(),
    paidAt: z.string().optional().or(z.date().optional()),
});

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const body = await request.json();
        const validatedData = paymentUpdateSchema.parse(body);

        // Check permissions
        if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "DIRECTOR"].includes(session.user.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const existingPayment = await prisma.payment.findUnique({
            where: { id },
            select: {
                studentId: true,
                feeId: true,
                paidAt: true, status: true,
                student: {
                    select: {
                        user: {
                            select: { schoolId: true },
                        },
                    },
                },
                fee: {
                    select: { schoolId: true },
                },
            },
        });

        if (!existingPayment) {
            return NextResponse.json({ error: "Payment not found" }, { status: 404 });
        }

        if (
            session.user.role !== "SUPER_ADMIN" &&
            (
                !session.user.schoolId ||
                existingPayment.student.user.schoolId !== session.user.schoolId ||
                existingPayment.fee.schoolId !== session.user.schoolId
            )
        ) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Financial Integrity Check: Block modification of verified/reconciled payments
        if (["VERIFIED", "RECONCILED"].includes(existingPayment.status) && session.user.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Ce paiement est verrouillé (Vérifié/Réconcilié) et ne peut être modifié." }, { status: 403 });
        }

        const nextStatus = validatedData.status;
        const payment = await prisma.payment.update({
            where: { id },
            data: {
                amount: validatedData.amount,
                method: validatedData.method as any,
                reference: validatedData.reference,
                status: validatedData.status as any,
                notes: validatedData.notes,
                paidAt:
                    validatedData.paidAt
                        ? new Date(validatedData.paidAt)
                        : (nextStatus === "VERIFIED" || nextStatus === "RECONCILED") &&
                            !existingPayment.paidAt
                            ? new Date()
                            : undefined,
            },
            include: {
                student: { include: { user: true } },
                fee: true
            }
        });

        await syncPaymentPlanLedger(
            prisma,
            existingPayment.studentId,
            existingPayment.feeId
        );
        await Promise.all([
            invalidateByPath(CACHE_PATHS.payments),
            invalidateByPath("/api/payments"),
            invalidateByPath("/api/finance/dashboard"),
            invalidateByPath("/api/finance/stats"),
            invalidateByPath("/api/finance/reports/generate"),
        ]);

        return NextResponse.json(payment);
    } catch (error) {
        logger.error("Error updating payment", error instanceof Error ? error : new Error(String(error)), { module: "api/finance/payments" });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(session.user.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // 1. Fetch the payment to get its amount, studentId, and feeId
        const payment = await prisma.payment.findUnique({
            where: { id },
            select: {
                amount: true,
                studentId: true,
                feeId: true,
                status: true,
                student: {
                    select: {
                        user: {
                            select: { schoolId: true },
                        },
                    },
                },
                fee: {
                    select: { schoolId: true },
                },
            },
        });

        if (!payment) {
            return NextResponse.json({ error: "Payment not found" }, { status: 404 });
        }

        if (
            session.user.role !== "SUPER_ADMIN" &&
            (
                !session.user.schoolId ||
                payment.student.user.schoolId !== session.user.schoolId ||
                payment.fee.schoolId !== session.user.schoolId
            )
        ) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Financial Integrity Check: Block deletion of verified/reconciled payments
        if (["VERIFIED", "RECONCILED"].includes(payment.status) && session.user.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Impossible de supprimer un paiement déjà vérifié ou réconcilié." }, { status: 403 });
        }

        // 2. Perform soft delete + PaymentPlan adjustment atomically
        await prisma.$transaction(async (tx) => {
            // Soft delete the payment
            await tx.payment.update({
                where: { id },
                data: { status: "CANCELLED" },
            });

            await syncPaymentPlanLedger(tx, payment.studentId, payment.feeId);
        });

        await Promise.all([
            invalidateByPath(CACHE_PATHS.payments),
            invalidateByPath("/api/payments"),
            invalidateByPath("/api/finance/dashboard"),
            invalidateByPath("/api/finance/stats"),
            invalidateByPath("/api/finance/reports/generate"),
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error("Error deleting payment", error instanceof Error ? error : new Error(String(error)), { module: "api/finance/payments" });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
