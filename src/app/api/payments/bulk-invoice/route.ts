import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";

import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import prisma from "@/lib/prisma";
import { canAccessSchool } from "@/lib/api/tenant-isolation";

const bulkInvoiceSchema = z.object({
  paymentIds: z.array(z.string().cuid()).min(1).max(100),
});

/**
 * POST /api/payments/bulk-invoice
 * Generate multiple invoices (Admin/Accountant only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    const allowedRoles = [
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
      "DIRECTOR",
      "ACCOUNTANT",
    ];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = bulkInvoiceSchema.parse(body);

    if (session.user.role !== "SUPER_ADMIN") {
      const payments = await prisma.payment.findMany({
        where: { id: { in: validatedData.paymentIds } },
        select: { id: true, fee: { select: { schoolId: true } } },
      });
      if (payments.length !== validatedData.paymentIds.length) {
        return NextResponse.json({ error: "Paiements invalides" }, { status: 400 });
      }
      const outOfScope = payments.some((payment) => !canAccessSchool(session, payment.fee.schoolId));
      if (outOfScope) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    // Generate invoice URLs for each payment
    const invoiceUrls = validatedData.paymentIds.map((id) => ({
      paymentId: id,
      invoiceUrl: `/api/payments/${id}/invoice`,
    }));

    return NextResponse.json({
      success: true,
      count: invoiceUrls.length,
      invoices: invoiceUrls,
    });
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }

    logger.error(" generating bulk invoices:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la génération des factures" },
      { status: 500 }
    );
  }
}
