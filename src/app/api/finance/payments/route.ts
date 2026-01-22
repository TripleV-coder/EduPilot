import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { paymentSchema } from "@/lib/validations/finance";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Role check
        const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "DIRECTOR"];
        if (!allowedRoles.includes(session.user.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

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

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

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
    } catch (error) {
        console.error("Error fetching payments:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userRole = session.user.role;
        // Assistants might accept payments too? For now only Accountant/Admin
        if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const validatedData = paymentSchema.parse(body);

        // TODO: Verify student belongs to school and Fee belongs to school
        // Assuming IDs are valid for now

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
                    receivedBy: session.user.id,
                    paidAt: validatedData.paidAt || new Date(),
                },
            });

            // 2. Update Payment Plan if exists
            const paymentPlan = await tx.paymentPlan.findFirst({
                where: {
                    studentId: validatedData.studentId,
                    feeId: validatedData.feeId
                }
            });

            if (paymentPlan) {
                // Update paidAmount
                await tx.paymentPlan.update({
                    where: { id: paymentPlan.id },
                    data: {
                        paidAmount: { increment: validatedData.amount },
                        status: (Number(paymentPlan.paidAmount) + validatedData.amount) >= Number(paymentPlan.totalAmount) ? "COMPLETED" : "ACTIVE"
                    }
                });

                // Logic to link to specific installment could be added here
            } else {
                // If no payment plan, maybe create one on the fly or just log the payment?
                // Usually payment plan is metadata. 
                // We might want to ensure a PaymentPlan exists (even if 1 installment) to track balance.
                // For now, simple payment logging.
            }

            return newPayment;
        });

        return NextResponse.json(payment, { status: 201 });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        console.error("Error creating payment:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
