import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { paymentSchema } from "@/lib/validations/finance";
import { syncPaymentPlanLedger } from "@/lib/finance/helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";
import { nanoid } from "nanoid";

const MANUAL_PAYMENT_METHODS = ["CASH", "CHECK", "BANK_TRANSFER", "OTHER"] as const;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const validatedData = paymentSchema.parse(body);

    if (!(MANUAL_PAYMENT_METHODS as readonly string[]).includes(validatedData.method)) {
      return NextResponse.json({ error: "Mode de paiement manuel invalide" }, { status: 400 });
    }

    const [student, fee, paymentPlan] = await Promise.all([
      prisma.studentProfile.findUnique({
        where: { id: validatedData.studentId },
        select: { id: true, schoolId: true },
      }),
      prisma.fee.findUnique({
        where: { id: validatedData.feeId },
        select: { id: true, schoolId: true },
      }),
      prisma.paymentPlan.findFirst({
        where: { studentId: validatedData.studentId, feeId: validatedData.feeId, status: { not: "CANCELLED" } }
      })
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

    if (paymentPlan) {
      const remainingBalance = Number(paymentPlan.totalAmount) - Number(paymentPlan.paidAmount);
      if (validatedData.amount > remainingBalance) {
        return NextResponse.json({
          error: `Le montant saisi (${validatedData.amount}) dépasse le solde restant à payer (${remainingBalance})`
        }, { status: 400 });
      }
    }

    const payment = await prisma.$transaction(async (tx) => {
      const createdPayment = await tx.payment.create({
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

      await syncPaymentPlanLedger(tx, validatedData.studentId, validatedData.feeId);
      return createdPayment;
    });

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
    return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
  }
}
