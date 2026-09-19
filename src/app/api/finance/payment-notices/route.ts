import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { buildNoticeBatch, isNoticeError, renderNoticesPdf } from "@/lib/finance/payment-notices";

const noticesSchema = z.object({
  feeId: z.string().min(1),
  classLevelId: z.string().min(1),
  format: z.enum(["summary", "pdf"]).default("summary"),
});

/**
 * POST /api/finance/payment-notices
 * Reste à payer d'un frais pour tous les élèves d'un niveau (`summary`), ou
 * PDF d'avis de paiement, une page par élève débiteur (`pdf`). N'écrit rien.
 */
export const POST = createApiHandler(
  async (request, { session }) => {
    const body = noticesSchema.parse(await request.json());
    const batch = await buildNoticeBatch({
      feeId: body.feeId,
      classLevelId: body.classLevelId,
      canAccessSchool: (schoolId) => canAccessSchool(session, schoolId),
    });
    if (isNoticeError(batch)) {
      return NextResponse.json({ error: batch.error }, { status: batch.status });
    }

    const debtors = batch.rows.filter((row) => row.remaining > 0);

    if (body.format === "pdf") {
      if (debtors.length === 0) {
        return NextResponse.json({ error: "Aucun élève de ce niveau ne doit encore ce frais." }, { status: 400 });
      }
      const pdf = await renderNoticesPdf(batch);
      const filename = `avis-paiement-${batch.classLevel.name}-${batch.fee.name}`
        .normalize("NFD")
        .replace(/[^\w-]+/g, "-")
        .toLowerCase();
      return new Response(pdf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json({
      fee: batch.fee,
      classLevel: batch.classLevel,
      academicYear: batch.academicYear,
      rows: batch.rows,
      totals: {
        students: batch.rows.length,
        debtors: debtors.length,
        due: batch.rows.reduce((sum, row) => sum + row.due, 0),
        paid: batch.rows.reduce((sum, row) => sum + row.paid, 0),
        remaining: batch.rows.reduce((sum, row) => sum + row.remaining, 0),
      },
    });
  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] }
);
