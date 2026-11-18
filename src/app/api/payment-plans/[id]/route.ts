import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";
import { roleSatisfies } from "@/lib/rbac/permissions";
import { createApiHandler } from "@/lib/api/api-helpers";
import { refuse, runFeeMutation } from "@/lib/finance/collection";
import { assertCoherentPaymentPlan } from "@/lib/finance/helpers";

// GET /api/payment-plans/[id] - Get payment plan details
export const GET = createApiHandler(async (request, context) => {
  try {
    const { id } = await context.params;
    const session = context.session;
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
    } else if (!roleSatisfies(session.user.role, ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    return NextResponse.json(paymentPlan);
  } catch (error) {
    logger.error(" fetching payment plan:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
});

// DELETE /api/payment-plans/[id] - Cancel payment plan
export const DELETE = createApiHandler(
  async (request, context) => {
    try {
      const { id } = await context.params;
      const session = context.session;
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

      // Annulation sous le verrou élève/frais, en transaction (lot 3d) :
      // refusée dès qu'une opération de paiement existe pour ce frais, quel
      // que soit son statut — un essai en attente, expiré ou annulé peut
      // encore être confirmé. Aucun paiement n'est modifié.
      const result = await runFeeMutation(paymentPlan.studentId, paymentPlan.feeId, async (tx) => {
        const current = await tx.paymentPlan.findUnique({
          where: { id },
          select: { id: true, status: true, student: { select: { schoolId: true } }, fee: { select: { schoolId: true } } },
        });
        if (!current) return refuse(404, "Plan de paiement non trouvé");
        // Plan incohérent : conservé tel quel, même son annulation est refusée
        assertCoherentPaymentPlan(current);
        if (current.status === "CANCELLED") refuse(400, "Plan de paiement déjà annulé");
        const operations = await tx.payment.count({
          where: { studentId: paymentPlan.studentId, feeId: paymentPlan.feeId },
        });
        if (operations > 0) {
          refuse(409, "Impossible d'annuler ce plan : des opérations de paiement existent déjà pour ces frais.");
        }
        return tx.paymentPlan.update({ where: { id }, data: { status: "CANCELLED" } });
      });
      if (!result.ok) return NextResponse.json({ error: result.refusal.error }, { status: result.refusal.status });

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
          link: "/dashboard/finance",
        },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error(" cancelling payment plan:", error as Error);
      return NextResponse.json({ error: "Erreur" }, { status: 500 });
    }
  },
  { allowedRoles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] }
);
