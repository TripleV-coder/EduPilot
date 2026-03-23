import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";

// GET /api/payment-plans/[id] - Get payment plan details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const guard = await assertModelAccess(session, "paymentPlan", id, "Plan de paiement non trouvé");
    if (guard) return guard;

    const paymentPlan = await prisma.paymentPlan.findUnique({
      where: { id: id },
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
        fee: {
          include: {
            academicYear: true,
          },
        },
        installmentPayments: {
          orderBy: { dueDate: "asc" },
        },
      },
    });

    if (!paymentPlan) {
      return NextResponse.json({ error: "Plan de paiement non trouvé" }, { status: 404 });
    }

    // Verify access
    if (session.user.role === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (studentProfile?.id !== paymentPlan.studentId) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    } else if (session.user.role === "PARENT") {
      const isParent = paymentPlan.student.parentStudents.some(
        link => link.parent.user.id === session.user.id
      );
      if (!isParent) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    } else if (!["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    return NextResponse.json(paymentPlan);
  } catch (error) {
    logger.error(" fetching payment plan:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// DELETE /api/payment-plans/[id] - Cancel payment plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user || !["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    const guard = await assertModelAccess(session, "paymentPlan", id, "Plan de paiement non trouvé");
    if (guard) return guard;

    const paymentPlan = await prisma.paymentPlan.findUnique({
      where: { id: id },
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
          },
        },
        installmentPayments: true,
      },
    });

    if (!paymentPlan) {
      return NextResponse.json({ error: "Plan de paiement non trouvé" }, { status: 404 });
    }

    // Check if any installments have been paid
    const hasPaidInstallments = paymentPlan.installmentPayments.some(
      inst => inst.status === "PAID"
    );

    if (hasPaidInstallments) {
      return NextResponse.json({ error: "Impossible de supprimer un plan avec des paiements effectués" }, { status: 400 });
    }

    // Update status to CANCELLED instead of deleting
    await prisma.paymentPlan.update({
      where: { id: id },
      data: { status: "CANCELLED" },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE",
        entity: "PaymentPlan",
        entityId: id,
      },
    });

    // Notify student
    await prisma.notification.create({
      data: {
        userId: paymentPlan.student.user.id,
        type: "WARNING",
        title: "Plan de paiement annulé",
        message: "Votre plan de paiement a été annulé",
        link: `/payments/plans/${id}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(" cancelling payment plan:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
