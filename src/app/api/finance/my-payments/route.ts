import { createApiHandler } from "@/lib/api/api-helpers";
import prisma from "@/lib/prisma";
import { Permission } from "@/lib/rbac/permissions";
import { Prisma } from "@prisma/client";

interface Payment {
    id: string;
    feeName: string;
    amount: number | Prisma.Decimal;
    date: Date;
    method: string;
}

export const GET = createApiHandler(
    async (req, { session }) => {
        if (session.user.role !== "PARENT") {
            return Response.json({ error: "Unauthorized" }, { status: 403 });
        }

        const parentProfile = await prisma.parentProfile.findUnique({
            where: { userId: session.user.id },
            include: {
                parentStudents: {
                    include: {
                        student: {
                            include: {
                                user: true,
                                paymentPlans: {
                                    include: {
                                        fee: true,
                                        installmentPayments: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!parentProfile) {
            return Response.json({ totalPending: 0, totalPaid: 0, payments: [] });
        }

        let totalPending = 0;
        let totalPaid = 0;
        const payments: Payment[] = [];
        let nextDueDate: Date | null = null;

        for (const ps of parentProfile.parentStudents) {
            for (const plan of ps.student.paymentPlans) {
                totalPending += (Number(plan.totalAmount) - Number(plan.paidAmount));
                totalPaid += Number(plan.paidAmount);

                // Extract individual payments
                for (const installment of plan.installmentPayments) {
                    if (installment.status === "PAID") {
                        payments.push({
                            id: installment.id,
                            feeName: `${plan.fee.name} (${ps.student.user.firstName})`,
                            amount: installment.amount,
                            date: installment.paidAt || installment.updatedAt,
                            method: "CASH" // Defaulting as we don't have method in installmentPayment
                        });
                    } else if (installment.status === "PENDING") {
                        if (!nextDueDate || new Date(installment.dueDate) < nextDueDate) {
                            nextDueDate = new Date(installment.dueDate);
                        }
                    }
                }
            }
        }

        return Response.json({
            totalPending,
            totalPaid,
            nextDueDate,
            payments: payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        });
    }
);
