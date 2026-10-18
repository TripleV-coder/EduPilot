import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { paymentSchema } from "@/lib/validations/finance";
import { assertReferenceFree, assertWithinAvailable, runFeeMutation } from "@/lib/finance/collection";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { superAdminTargetOutOfScope } from "@/lib/finance/finance-scope";
import { logger } from "@/lib/utils/logger";
import { nanoid } from "nanoid";

const MANUAL_PAYMENT_METHODS = ["CASH", "CHECK", "BANK_TRANSFER", "OTHER"] as const;
/**
 * Transfert Mobile Money déjà reçu sur le numéro de l'établissement : il
 * s'enregistre au guichet comme un encaissement manuel, à condition de porter
 * la référence de la transaction (preuve et rapprochement).
 */
const RECEIVED_MOBILE_MONEY_METHODS = ["MOBILE_MONEY_MTN", "MOBILE_MONEY_MOOV"] as const;

export const POST = createApiHandler(
  async (request, context) => {
    const session = context.session;

    try {
      const body = await request.json();
      const validatedData = paymentSchema.parse(body);

      const isReceivedMobileMoney = (RECEIVED_MOBILE_MONEY_METHODS as readonly string[]).includes(validatedData.method);
      if (isReceivedMobileMoney && !validatedData.reference?.trim()) {
        return NextResponse.json(
          { error: "Indiquez la référence de la transaction Mobile Money reçue." },
          { status: 400 }
        );
      }
      if (!isReceivedMobileMoney && !(MANUAL_PAYMENT_METHODS as readonly string[]).includes(validatedData.method)) {
        return NextResponse.json({ error: "Mode de paiement manuel invalide" }, { status: 400 });
      }

      const [student, fee] = await Promise.all([
        prisma.studentProfile.findUnique({
          where: { id: validatedData.studentId },
          select: { id: true, schoolId: true },
        }),
        prisma.fee.findUnique({
          where: { id: validatedData.feeId },
          select: { id: true, schoolId: true },
        }),
      ]);

      if (!student) {
        return NextResponse.json({ error: "Élève non trouvé" }, { status: 404 });
      }

      if (!fee) {
        return NextResponse.json({ error: "Frais non trouvé" }, { status: 404 });
      }

      if (
        session.user.role !== "SUPER_ADMIN" &&
        (!canAccessSchool(session, student.schoolId) || !canAccessSchool(session, fee.schoolId))
      ) {
        return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
      }

      // Intégrité (lot 3f) : un paiement n'impute jamais le frais d'une autre école
      if (fee.schoolId !== student.schoolId) {
        return NextResponse.json({ error: "Les frais n'appartiennent pas à l'établissement de l'élève." }, { status: 403 });
      }
      const outOfScope = await superAdminTargetOutOfScope(session, fee.schoolId, "payments:cash");
      if (outOfScope) return outOfScope;

      // Plafond relu sous verrou, avec ou sans échéancier (lot 3b)
      const result = await runFeeMutation(validatedData.studentId, validatedData.feeId, async (tx, balance) => {
        assertWithinAvailable(balance.available, validatedData.amount);
        await assertReferenceFree(tx, validatedData.reference);
        return tx.payment.create({
          data: {
            amount: validatedData.amount,
            method: validatedData.method,
            feeId: validatedData.feeId,
            studentId: validatedData.studentId,
            status: "VERIFIED",
            receivedBy: session.user.id,
            paidAt: validatedData.paidAt || new Date(),
            notes: validatedData.notes,
            reference: validatedData.reference || `MANUAL-${Date.now()}-${nanoid(6).toUpperCase()}`,
          },
        });
      });
      if (!result.ok) return NextResponse.json({ error: result.refusal.error }, { status: result.refusal.status });
      const payment = result.value;

      await Promise.all([
        invalidateByPath(CACHE_PATHS.payments).catch(() => { }),
        invalidateByPath("/api/payments").catch(() => { }),
        invalidateByPath("/api/finance/dashboard").catch(() => { }),
        invalidateByPath("/api/finance/stats").catch(() => { }),
        invalidateByPath("/api/finance/reports/generate").catch(() => { }),
      ]);

      return NextResponse.json(payment);
    } catch (error) {
      logger.error("Cash payment failed", error instanceof Error ? error : new Error(String(error)), { module: "api/payments/cash" });
      return NextResponse.json({ error: "Impossible d'enregistrer le paiement" }, { status: 500 });
    }
  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] }
);
