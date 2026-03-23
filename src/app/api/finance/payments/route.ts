import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { paymentSchema } from "@/lib/validations/finance";
import { Prisma } from "@prisma/client";
import { createApiHandler } from "@/lib/api/api-helpers";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import {
    buildPaymentDateWhere,
    syncPaymentPlanLedger,
} from "@/lib/finance/helpers";


export const GET = createApiHandler(
    async (request: NextRequest, { session }) => {
        const { searchParams } = new URL(request.url);
        const studentId = searchParams.get("studentId");
        const feeId = searchParams.get("feeId");
        const method = searchParams.get("method");
        const status = searchParams.get("status");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const page = parseInt(searchParams.get("page") || "1");
        const pageSize = parseInt(searchParams.get("pageSize") || "20");

        const where: Prisma.PaymentWhereInput = {};

        if (studentId) where.studentId = studentId;
        if (feeId) where.feeId = feeId;
        if (method) where.method = method as any; // Cast to enum
        if (status) where.status = status as any; // Cast to enum

        Object.assign(where, buildPaymentDateWhere({
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
        }));

        // Improve: Filter by school (via Student or Fee)
        // Account for accountant only seeing their school's payments
        // This requires cross-relation filtering which Prisma supports
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { schoolId: true }
        });

        if (user?.schoolId) {
            // Filter payments where the Student belongs to the School OR the Fee belongs to the School
            // Usually Fee is bound to school
            where.fee = { schoolId: user.schoolId };
        }

        const [payments, total] = await Promise.all([
            prisma.payment.findMany({
                where,
                include: {
                    student: {
                        include: {
                            user: { select: { firstName: true, lastName: true } }
                        }
                    },
                    fee: { select: { id: true, name: true, amount: true } },
                    // receiver info?
                },
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { createdAt: "desc" },
            }),
            prisma.payment.count({ where }),
        ]);

        return NextResponse.json({
            data: payments,
            meta: {
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            }
        });
    }
    , { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "DIRECTOR"] });

export const POST = createApiHandler(
    async (request: NextRequest, { session: authSession }) => {
        const _userRole = authSession.user.role;
        const body = await request.json();
        const validatedData = paymentSchema.parse(body);

        const receivedByUserId = authSession.user.id;
        const actorSchoolId = authSession.user.schoolId;

        // Vérification multi-tenant : le student ET la fee doivent appartenir
        // à l'école de l'utilisateur connecté (sauf SUPER_ADMIN).
        if (actorSchoolId) {
            const [student, fee] = await Promise.all([
                prisma.studentProfile.findUnique({
                    where: { id: validatedData.studentId },
                    select: { user: { select: { schoolId: true } } },
                }),
                prisma.fee.findUnique({
                    where: { id: validatedData.feeId },
                    select: { schoolId: true },
                }),
            ]);

            if (!student || student.user.schoolId !== actorSchoolId) {
                return NextResponse.json({ error: "Étudiant introuvable ou hors périmètre" }, { status: 403 });
            }
            if (!fee || fee.schoolId !== actorSchoolId) {
                return NextResponse.json({ error: "Frais introuvable ou hors périmètre" }, { status: 403 });
            }
        }

        const payment = await prisma.$transaction(async (tx) => {
            // 1. Create Payment
            const newPayment = await tx.payment.create({
                data: {
                    studentId: validatedData.studentId,
                    feeId: validatedData.feeId,
                    amount: validatedData.amount,
                    method: validatedData.method,
                    reference: validatedData.reference,
                    notes: validatedData.notes,
                    status: "VERIFIED", // Direct creation by accountant = verified? Or PENDING?
                    // Let's assume verified if created by staff manually
                    receivedBy: receivedByUserId,
                    paidAt: validatedData.paidAt || new Date(),
                },
            });

            await syncPaymentPlanLedger(
                tx,
                validatedData.studentId,
                validatedData.feeId
            );

            return newPayment;
        });

        await Promise.all([
            invalidateByPath(CACHE_PATHS.payments),
            invalidateByPath("/api/finance/dashboard"),
            invalidateByPath("/api/finance/stats"),
            invalidateByPath("/api/finance/reports/generate"),
        ]);

        return NextResponse.json(payment, { status: 201 });
    }
    , { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "DIRECTOR"] });
