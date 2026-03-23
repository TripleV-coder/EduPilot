import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { syncPaymentPlanLedger } from "@/lib/finance/helpers";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";

const payInstallmentSchema = z.object({
  method: z.enum(["CASH", "MOBILE_MONEY_MTN", "MOBILE_MONEY_MOOV", "BANK_TRANSFER", "CHECK", "OTHER"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

// POST /api/payment-plans/[id]/installments/[installmentId]/pay - Process installment payment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; installmentId: string }> }
) {
  try {
    const { id, installmentId } = await params;
    const session = await auth();
    if (!session?.user || !["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    const guard = await assertModelAccess(session, "installmentPayment", installmentId, "Mensualité non trouvée");
    if (guard) return guard;

    const body = await request.json();
    const validatedData = payInstallmentSchema.parse(body);

    // Get installment payment
    const installment = await prisma.installmentPayment.findUnique({
      where: { id: installmentId },
      include: {
        paymentPlan: {
          include: {
            student: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
                parentStudents: {
                  include: {
                    parent: {
                      include: {
                        user: {
                          select: { id: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            fee: true,
          },
        },
      },
    });

    if (!installment) {
      return NextResponse.json({ error: "Mensualité non trouvée" }, { status: 404 });
    }

    if (installment.paymentPlanId !== id) {
      return NextResponse.json({ error: "Mensualité ne correspond pas au plan" }, { status: 400 });
    }

    if (installment.status === "PAID") {
      return NextResponse.json({ error: "Mensualité déjà payée" }, { status: 400 });
    }

    if (!["ACTIVE", "OVERDUE"].includes(installment.paymentPlan.status)) {
      return NextResponse.json({ error: "Plan de paiement non actif" }, { status: 400 });
    }

    const paymentTimestamp = new Date();

    // Mark installment as paid
    const updatedInstallment = await prisma.installmentPayment.update({
      where: { id: installmentId },
      data: {
        status: "PAID",
        paidAt: paymentTimestamp,
      },
    });

    // Update payment plan paid amount
    const newPaidAmount = new Decimal(installment.paymentPlan.paidAmount.toString())
      .add(new Decimal(installment.amount.toString()));

    const totalAmount = new Decimal(installment.paymentPlan.totalAmount.toString());
    const isFullyPaid = newPaidAmount.greaterThanOrEqualTo(totalAmount);

    const updatedPlan = await prisma.paymentPlan.update({
      where: { id: id },
      data: {
        paidAmount: newPaidAmount.toNumber(),
        status: isFullyPaid ? "COMPLETED" : "ACTIVE",
      },
      include: {
        installmentPayments: {
          orderBy: { dueDate: "asc" },
        },
      },
    });

    // Create payment record
    await prisma.payment.create({
      data: {
        studentId: installment.paymentPlan.studentId,
        feeId: installment.paymentPlan.feeId,
        amount: installment.amount,
        method: validatedData.method,
        reference: validatedData.reference,
        notes: `${validatedData.notes || ""} - Mensualité ${updatedPlan.installmentPayments.filter(i => i.status === "PAID").length}/${updatedPlan.installments}`,
        status: "VERIFIED",
        paidAt: paymentTimestamp,
        receivedBy: session.user.id,
      },
    });

    const syncedPlan = await syncPaymentPlanLedger(
      prisma,
      installment.paymentPlan.studentId,
      installment.paymentPlan.feeId
    );
    const effectivePlan = syncedPlan ?? updatedPlan;
    const planCompleted = effectivePlan.status === "COMPLETED";

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entity: "InstallmentPayment",
        entityId: installmentId,
      },
    });

    // Notify student
    await prisma.notification.create({
      data: {
        userId: installment.paymentPlan.student.user.id,
        type: "SUCCESS",
        title: "Paiement reçu",
        message: `Votre paiement de ${installment.amount} a été reçu${planCompleted ? ". Plan de paiement terminé !" : ""}`,
        link: `/payments/plans/${id}`,
      },
    });

    // Notify parents
    if (installment.paymentPlan.student.parentStudents.length > 0) {
      await prisma.notification.createMany({
        data: installment.paymentPlan.student.parentStudents.map(link => ({
          userId: link.parent.user.id,
          type: "SUCCESS",
          title: "Paiement reçu",
          message: `Paiement de ${installment.amount} reçu pour ${installment.paymentPlan.student.user.firstName}${planCompleted ? ". Plan de paiement terminé !" : ""}`,
          link: `/payments/plans/${id}`,
        })),
      });
    }

    await Promise.all([
      invalidateByPath(CACHE_PATHS.payments),
      invalidateByPath("/api/finance/dashboard"),
      invalidateByPath("/api/finance/stats"),
      invalidateByPath("/api/finance/reports/generate"),
    ]);

    return NextResponse.json({
      installment: updatedInstallment,
      paymentPlan: effectivePlan,
      isFullyPaid: planCompleted,
    });
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    logger.error(" processing installment payment:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
