import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { createApiHandler } from "@/lib/api/api-helpers";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import {
    assertReferenceFree,
    assertWithinAvailable,
    availableWithout,
    refuse,
    runFeeMutation,
    wouldWeigh,
} from "@/lib/finance/collection";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";
import { z } from "zod";
import { fcfaAmountSchema } from "@/lib/finance/money";

const paymentUpdateSchema = z.object({
    amount: fcfaAmountSchema.optional(),
    method: z.string().optional(),
    reference: z.string().optional(),
    status: z.enum(["PENDING", "COMPLETED", "FAILED", "CANCELLED", "VERIFIED", "RECONCILED"]).optional(),
    notes: z.string().optional(),
    paidAt: z.string().optional().or(z.date().optional()),
});

export const PUT = createApiHandler(
    async (request, context) => {
        try {
            const session = context.session;
            const { id } = await context.params;
            const body = await request.json();
            const validatedData = paymentUpdateSchema.parse(body);

            const existingPayment = await prisma.payment.findUnique({
                where: { id },
                select: {
                    studentId: true,
                    feeId: true,
                    paidAt: true, status: true,
                    student: {
                        select: { schoolId: true },
                    },
                    fee: {
                        select: { schoolId: true },
                    },
                },
            });

            if (!existingPayment) {
                return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
            }

            if (
                session.user.role !== "SUPER_ADMIN" &&
                (
                    !canAccessSchool(session, existingPayment.student.schoolId) ||
                    !canAccessSchool(session, existingPayment.fee.schoolId)
                )
            ) {
                return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
            }

            if (["VERIFIED", "RECONCILED"].includes(existingPayment.status) && session.user.role !== "SUPER_ADMIN") {
                return NextResponse.json({ error: "Ce paiement est verrouillé (Vérifié/Réconcilié) et ne peut être modifié." }, { status: 403 });
            }

            const nextStatus = validatedData.status;
            // Une seule transaction sous verrou élève/frais (lot 3b) : état relu,
            // verrouillage revérifié (un webhook a pu valider entre-temps),
            // plafond appliqué si le paiement pèse sur le solde, puis recalcul.
            const result = await runFeeMutation(existingPayment.studentId, existingPayment.feeId, async (tx, balance) => {
                const current = await tx.payment.findUnique({ where: { id } });
                if (!current) return refuse(404, "Paiement introuvable");
                if (["VERIFIED", "RECONCILED"].includes(current.status) && session.user.role !== "SUPER_ADMIN") {
                    refuse(403, "Ce paiement est verrouillé (Vérifié/Réconcilié) et ne peut être modifié.");
                }
                const finalStatus = (nextStatus as PaymentStatus | undefined) ?? current.status;
                const finalAmount = validatedData.amount ?? Number(current.amount);
                if (wouldWeigh(finalStatus)) {
                    assertWithinAvailable(availableWithout(balance, current), finalAmount);
                }
                await assertReferenceFree(tx, validatedData.reference, id);
                return tx.payment.update({
                    where: { id },
                    data: {
                        amount: validatedData.amount,
                        method: (validatedData.method as PaymentMethod) || undefined,
                        reference: validatedData.reference,
                        status: validatedData.status as PaymentStatus,
                        // Annulation décidée par l'école (lot 3b)
                        ...(nextStatus === "CANCELLED" ? { cancellationSource: "MANUAL" as const } : {}),
                        notes: validatedData.notes,
                        paidAt:
                            validatedData.paidAt
                                ? new Date(validatedData.paidAt)
                                : (nextStatus === "VERIFIED" || nextStatus === "RECONCILED") &&
                                    !current.paidAt
                                    ? new Date()
                                    : undefined,
                    },
                    include: {
                        student: { include: { user: true } },
                        fee: true
                    }
                });
            });
            if (!result.ok) return NextResponse.json({ error: result.refusal.error }, { status: result.refusal.status });
            const payment = result.value;
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
            return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
        }
    },
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "DIRECTOR"] }
);

export const DELETE = createApiHandler(
    async (request, context) => {
        try {
            const session = context.session;
            const { id } = await context.params;

            const payment = await prisma.payment.findUnique({
                where: { id },
                select: {
                    amount: true,
                    studentId: true,
                    feeId: true,
                    status: true,
                    student: {
                        select: { schoolId: true },
                    },
                    fee: {
                        select: { schoolId: true },
                    },
                },
            });

            if (!payment) {
                return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
            }

            if (
                session.user.role !== "SUPER_ADMIN" &&
                (
                    !canAccessSchool(session, payment.student.schoolId) ||
                    !canAccessSchool(session, payment.fee.schoolId)
                )
            ) {
                return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
            }

            if (["VERIFIED", "RECONCILED"].includes(payment.status) && session.user.role !== "SUPER_ADMIN") {
                return NextResponse.json({ error: "Impossible de supprimer un paiement déjà vérifié ou réconcilié." }, { status: 403 });
            }

            // Sous verrou élève/frais, verrouillage revérifié sur l'état relu (lot 3b)
            const result = await runFeeMutation(payment.studentId, payment.feeId, async (tx) => {
                const current = await tx.payment.findUnique({ where: { id }, select: { status: true } });
                if (!current) return refuse(404, "Paiement introuvable");
                if (["VERIFIED", "RECONCILED"].includes(current.status) && session.user.role !== "SUPER_ADMIN") {
                    refuse(403, "Impossible de supprimer un paiement déjà vérifié ou réconcilié.");
                }
                return tx.payment.update({ where: { id }, data: { status: "CANCELLED", cancellationSource: "MANUAL" } });
            });
            if (!result.ok) return NextResponse.json({ error: result.refusal.error }, { status: result.refusal.status });

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
            return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
        }
    },
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] }
);
