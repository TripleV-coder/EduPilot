import { createApiHandler } from "@/lib/api/api-helpers";
import prisma from "@/lib/prisma";
import { computeStudentFeeDues } from "@/lib/finance/expected-fees";
import { PAYMENT_METHOD_LABELS } from "@/lib/types/finance";

/** Paiements qui soldent réellement une dette (même règle que le tableau de bord finance). */
const SETTLED_STATUSES = ["VERIFIED", "RECONCILED"] as const;

/**
 * Vue finance du parent.
 *
 * Les paiements affichés sont les `Payment` validés des enfants — la source de
 * vérité (régler un versement d'échéancier crée aussi un `Payment`). Le reste à
 * payer additionne les échéanciers et les frais facturés sans échéancier : ne
 * lire que les échéanciers affichait 0 FCFA dû à un parent qui devait des frais.
 */
export const GET = createApiHandler(
    async (req, { session }) => {
        if (session.user.role !== "PARENT") {
            return Response.json({ error: "Non authentifié" }, { status: 403 });
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

        const firstNameById = new Map(
            parentProfile.parentStudents.map((ps) => [ps.student.id, ps.student.user.firstName])
        );
        const studentIds = [...firstNameById.keys()];

        const [settledPayments, dues] = await Promise.all([
            prisma.payment.findMany({
                where: { studentId: { in: studentIds }, deletedAt: null, status: { in: [...SETTLED_STATUSES] } },
                select: {
                    id: true,
                    studentId: true,
                    amount: true,
                    method: true,
                    paidAt: true,
                    createdAt: true,
                    fee: { select: { name: true } },
                },
                orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
                take: 100,
            }),
            computeStudentFeeDues(studentIds),
        ]);

        let totalPending = 0;
        let nextDueDate: Date | null = null;
        const noteDue = (date: Date | null) => {
            if (date && (!nextDueDate || date < nextDueDate)) nextDueDate = date;
        };

        for (const ps of parentProfile.parentStudents) {
            for (const plan of ps.student.paymentPlans) {
                if (plan.status === "CANCELLED") continue;
                totalPending += Math.max(0, Number(plan.totalAmount) - Number(plan.paidAmount));
                for (const installment of plan.installmentPayments) {
                    if (installment.status !== "PAID") noteDue(new Date(installment.dueDate));
                }
            }
        }
        for (const due of dues) {
            totalPending += due.remaining;
            noteDue(due.dueDate);
        }

        const payments = settledPayments.map((payment) => ({
            id: payment.id,
            feeName: `${payment.fee.name} (${firstNameById.get(payment.studentId) ?? "Enfant"})`,
            amount: Number(payment.amount),
            date: payment.paidAt ?? payment.createdAt,
            method: PAYMENT_METHOD_LABELS[payment.method] ?? payment.method,
        }));
        const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

        return Response.json({ totalPending, totalPaid, nextDueDate, payments });
    }
);
