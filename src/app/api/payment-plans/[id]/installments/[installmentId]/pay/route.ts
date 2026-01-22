import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { logger } from "@/lib/utils/logger";

const payInstallmentSchema = z.object({
  method: z.enum(["CASH", "MOBILE_MONEY_MTN", "MOBILE_MONEY_MOOV", "BANK_TRANSFER", "CHECK", "OTHER"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

// POST /api/payment-plans/[id]/installments/[installmentId]/pay - Process installment payment
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; installmentId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user || !["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = payInstallmentSchema.parse(body);

    // Get installment payment
    const installment = await prisma.installmentPayment.findUnique({
      where: { id: params.installmentId },
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
                parentLinks: {
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

    if (installment.paymentPlanId !== params.id) {
      return NextResponse.json({ error: "Mensualité ne correspond pas au plan" }, { status: 400 });
    }

    if (installment.status === "PAID") {
      return NextResponse.json({ error: "Mensualité déjà payée" }, { status: 400 });
    }

    if (installment.paymentPlan.status !== "ACTIVE") {
      return NextResponse.json({ error: "Plan de paiement non actif" }, { status: 400 });
    }

    // Mark installment as paid
    const updatedInstallment = await prisma.installmentPayment.update({
      where: { id: params.installmentId },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
    });

    // Update payment plan paid amount
    const newPaidAmount = new Decimal(installment.paymentPlan.paidAmount.toString())
      .add(new Decimal(installment.amount.toString()));

    const totalAmount = new Decimal(installment.paymentPlan.totalAmount.toString());
    const isFullyPaid = newPaidAmount.greaterThanOrEqualTo(totalAmount);

    const updatedPlan = await prisma.paymentPlan.update({
      where: { id: params.id },
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
        receivedBy: session.user.id,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entity: "InstallmentPayment",
        entityId: params.installmentId,
      },
    });

    // Notify student
    await prisma.notification.create({
      data: {
        userId: installment.paymentPlan.student.user.id,
        type: "SUCCESS",
        title: "Paiement reçu",
        message: `Votre paiement de ${installment.amount} a été reçu${isFullyPaid ? ". Plan de paiement terminé !" : ""}`,
        link: `/payments/plans/${params.id}`,
      },
    });

    // Notify parents
    if (installment.paymentPlan.student.parentLinks.length > 0) {
      await prisma.notification.createMany({
        data: installment.paymentPlan.student.parentLinks.map(link => ({
          userId: link.parent.user.id,
          type: "SUCCESS",
          title: "Paiement reçu",
          message: `Paiement de ${installment.amount} reçu pour ${installment.paymentPlan.student.user.firstName}${isFullyPaid ? ". Plan de paiement terminé !" : ""}`,
          link: `/payments/plans/${params.id}`,
        })),
      });
    }

    return NextResponse.json({
      installment: updatedInstallment,
      paymentPlan: updatedPlan,
      isFullyPaid,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
    }
    logger.error(" processing installment payment:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
