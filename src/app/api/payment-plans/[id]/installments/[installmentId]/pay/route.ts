import { NextResponse } from "next/server";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { assertReferenceFree, assertWithinAvailable, refuse, runFeeMutation } from "@/lib/finance/collection";
import { chronologicalCoverage } from "@/lib/finance/installment-coverage";
import { CURRENT_PLAN_ORDER, assertCoherentPaymentPlan } from "@/lib/finance/helpers";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";
import { createApiHandler } from "@/lib/api/api-helpers";

const payInstallmentSchema = z.object({
  method: z.enum(["CASH", "MOBILE_MONEY_MTN", "MOBILE_MONEY_MOOV", "BANK_TRANSFER", "CHECK", "OTHER"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

// POST /api/payment-plans/[id]/installments/[installmentId]/pay - Process installment payment
export const POST = createApiHandler(
  async (request, context) => {
    try {
      const { id, installmentId } = await context.params;
      const session = context.session;
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
      const { studentId, feeId } = installment.paymentPlan;
      const dateFr = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC" });

      // Une seule transaction sous verrou élève/frais (lot 3b). Imputation
      // chronologique (lot 3c) : seule l'échéance la plus ancienne non soldée
      // peut être réglée ici, pour son RESTE (une partie a pu être payée au
      // guichet). Le recalcul final reste celui de syncPaymentPlanLedger.
      const result = await runFeeMutation(studentId, feeId, async (tx, balance) => {
        // Le plan payé doit être le plan en vigueur, celui que recalcule
        // syncPaymentPlanLedger (même règle de choix, lot 3d)
        const plan = await tx.paymentPlan.findFirst({
          where: { studentId, feeId, status: { not: "CANCELLED" } },
          orderBy: CURRENT_PLAN_ORDER,
          select: {
            id: true,
            status: true,
            student: { select: { schoolId: true } },
            fee: { select: { schoolId: true } },
            installmentPayments: { select: { id: true, amount: true, dueDate: true, status: true } },
          },
        });
        if (!plan) return refuse(404, "Plan de paiement non trouvé");
        if (plan.id !== id) refuse(409, "Ce plan n'est plus le plan en vigueur pour ces frais : rechargez la page.");
        // Plan incohérent : refus contrôlé (409) AVANT d'écrire le paiement,
        // que la base refuserait aussi (garde-fou des paiements, lot S1)
        assertCoherentPaymentPlan(plan);
        if (!["ACTIVE", "OVERDUE"].includes(plan.status)) refuse(400, "Plan de paiement non actif");

        const coverage = chronologicalCoverage(plan.installmentPayments, balance.settled);
        const position = coverage.findIndex((c) => c.installment.id === installmentId);
        if (position < 0) return refuse(404, "Mensualité non trouvée");
        const target = coverage[position];
        if (target.outstanding <= 0) refuse(400, "Mensualité déjà payée");
        const oldest = coverage.find((c) => c.outstanding > 0)!;
        if (oldest.installment.id !== installmentId) {
          refuse(
            409,
            `Réglez d'abord l'échéance du ${dateFr.format(oldest.installment.dueDate)} (reste ${oldest.outstanding} FCFA) : les paiements sont imputés aux échéances les plus anciennes.`,
          );
        }
        assertWithinAvailable(balance.available, target.outstanding);
        await assertReferenceFree(tx, validatedData.reference);

        await tx.payment.create({
          data: {
            studentId,
            feeId,
            amount: target.outstanding,
            method: validatedData.method,
            reference: validatedData.reference,
            notes: `${validatedData.notes || ""} - Mensualité ${position + 1}/${coverage.length}`,
            status: "VERIFIED",
            paidAt: paymentTimestamp,
            receivedBy: session.user.id,
          },
        });
        return { amount: target.outstanding };
      });
      if (!result.ok) return NextResponse.json({ error: result.refusal.error }, { status: result.refusal.status });

      // État FINAL, après recalcul (et non l'état d'avant)
      const effectivePlan = result.plan!;
      const updatedInstallment = effectivePlan.installmentPayments.find((i) => i.id === installmentId) ?? null;
      const planCompleted = effectivePlan.status === "COMPLETED";
      const paidAmount = result.value.amount;

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
          message: `Votre paiement de ${paidAmount} FCFA a été reçu${planCompleted ? ". Plan de paiement terminé !" : ""}`,
          link: "/dashboard/finance",
        },
      });

      // Notify parents
      if (installment.paymentPlan.student.parentStudents.length > 0) {
        await prisma.notification.createMany({
          data: installment.paymentPlan.student.parentStudents.map(link => ({
            userId: link.parent.user.id,
            type: "SUCCESS",
            title: "Paiement reçu",
            message: `Paiement de ${paidAmount} FCFA reçu pour ${installment.paymentPlan.student.user.firstName}${planCompleted ? ". Plan de paiement terminé !" : ""}`,
            link: "/dashboard/finance",
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
  },
  { allowedRoles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] }
);
