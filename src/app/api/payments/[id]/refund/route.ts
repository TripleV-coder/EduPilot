import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { superAdminTargetOutOfScope } from "@/lib/finance/finance-scope";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { MAX_REFUND_REASON, recordRefund } from "@/lib/finance/refunds";
import { createAuditLog } from "@/lib/security/audit-log";
import { createNotifications } from "@/lib/services/notification.service";
import { sanitizePlainText } from "@/lib/sanitize";
import { logger } from "@/lib/utils/logger";

const refundSchema = z.object({
  amount: z.number().int().positive(),
  reason: z.string().trim().min(5, "Motif trop court (5 caractères minimum)").max(MAX_REFUND_REASON),
  method: z.enum(["CASH", "MOBILE_MONEY_MTN", "MOBILE_MONEY_MOOV", "BANK_TRANSFER", "CHECK", "OTHER"]),
  reference: z.string().trim().max(120).optional().nullable(),
});

const FR = new Intl.NumberFormat("fr-FR");

/**
 * POST /api/payments/[id]/refund — rembourse tout ou partie d'un paiement
 * encaissé (écriture d'extourne, voir lib/finance/refunds).
 *
 * Comptable et direction de l'école du paiement. Motif obligatoire ; journal
 * d'audit ; familles prévenues. Le reste à payer et l'échéancier sont
 * recalculés dans la même transaction.
 */
export const POST = createApiHandler(
  async (request, context) => {
    const session = context.session;
    const { id } = await context.params;

    const parsed = refundSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Données invalides", details: parsed.error.issues },
        { status: 400 },
      );
    }
    const reason = sanitizePlainText(parsed.data.reason).trim();
    if (reason.length < 5) {
      return NextResponse.json({ error: "Motif trop court (5 caractères minimum)" }, { status: 400 });
    }

    const payment = await prisma.payment.findUnique({
      where: { id },
      select: {
        id: true,
        studentId: true,
        feeId: true,
        provider: true,
        fee: { select: { name: true } },
        student: {
          select: {
            schoolId: true,
            user: { select: { id: true, firstName: true, lastName: true } },
            parentStudents: { select: { parent: { select: { userId: true } } } },
          },
        },
      },
    });
    if (!payment) {
      return NextResponse.json({ error: "Paiement non trouvé" }, { status: 404 });
    }
    if (session.user.role !== "SUPER_ADMIN" && !canAccessSchool(session, payment.student.schoolId)) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }
    const outOfScope = await superAdminTargetOutOfScope(session, payment.student.schoolId, "payments:refund");
    if (outOfScope) return outOfScope;

    try {
      const result = await recordRefund(payment, {
        paymentId: payment.id,
        amount: parsed.data.amount,
        reason,
        method: parsed.data.method,
        reference: parsed.data.reference ? sanitizePlainText(parsed.data.reference) : null,
        actorId: session.user.id,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.refusal.error }, { status: result.refusal.status });
      }
      const refund = result.value;

      await createAuditLog({
        userId: session.user.id,
        action: "PAYMENT_REFUND",
        entity: "Payment",
        entityId: payment.id,
        schoolId: payment.student.schoolId,
        severity: "WARNING",
        newValues: {
          refundId: refund.id,
          amount: refund.amount,
          method: parsed.data.method,
          reference: parsed.data.reference ?? null,
          reason,
          refundedTotal: refund.refundedTotal,
        },
      });

      const studentName = `${payment.student.user.firstName ?? ""} ${payment.student.user.lastName ?? ""}`.trim();
      const recipients = new Set<string>([
        payment.student.user.id,
        ...payment.student.parentStudents.map((link) => link.parent.userId),
      ]);
      await createNotifications(
        [...recipients].map((userId) => ({
          userId,
          type: "PAYMENT" as const,
          title: "Remboursement enregistré",
          message: `${FR.format(refund.amount)} FCFA remboursés sur « ${payment.fee.name} »${studentName ? ` (${studentName})` : ""}. Motif : ${reason}`,
          link: "/dashboard/finance",
        })),
      ).catch((error) => logger.error("refund notification failed", error as Error));

      await Promise.all([
        invalidateByPath(CACHE_PATHS.payments),
        invalidateByPath("/api/payments"),
        invalidateByPath("/api/finance/dashboard"),
        invalidateByPath("/api/finance/stats"),
        invalidateByPath("/api/finance/reports/generate"),
      ]);

      return NextResponse.json(
        {
          ...refund,
          // Paiement en ligne : l'argent se rend depuis l'espace du fournisseur.
          providerAction: payment.provider ? `Rendez la somme depuis votre espace ${payment.provider}.` : null,
        },
        { status: 201 },
      );
    } catch (error) {
      logger.error("refunding payment:", error as Error);
      return NextResponse.json({ error: "Erreur lors de l'enregistrement du remboursement" }, { status: 500 });
    }
  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] },
);
