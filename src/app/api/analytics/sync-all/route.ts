import { NextRequest, NextResponse } from "next/server";
import { syncAllStudentsForSchool } from "@/lib/services/analytics-sync";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";
import { getErrorMessage } from "@/lib/utils/error-message";
import { createApiHandler } from "@/lib/api/api-helpers";

export const POST = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

    const { academicYearId } = await request.json();
    const activeSchoolId = getActiveSchoolId(session);

    let yearId = academicYearId;
    if (!yearId) {
        const currentYear = await prisma.academicYear.findFirst({
            where: { schoolId: activeSchoolId as string, isCurrent: true },
            select: { id: true }
        });
        yearId = currentYear?.id;
    }

    if (!yearId) {
      return NextResponse.json({ error: "Année académique requise" }, { status: 400 });
    }

    const schoolId = activeSchoolId;
    if (!schoolId) {
        return NextResponse.json({ error: "Établissement requis" }, { status: 400 });
    }

    // Run sync in background (fire and forget for now, or long-await)
    // For better UX, we might want to use a job queue, but for now we'll do it direct
    const result = await syncAllStudentsForSchool(schoolId, yearId);

    return NextResponse.json({
      success: true,
      ...result
    });
  
    } catch (error) {
    logger.error("Error in global sync:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Erreur lors de la synchronisation globale") },
      { status: 500 }
    );
  }

});
