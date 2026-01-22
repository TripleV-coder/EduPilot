import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

import { z } from "zod";
import { logger } from "@/lib/utils/logger";

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
    if (error instanceof z.ZodError) {
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
