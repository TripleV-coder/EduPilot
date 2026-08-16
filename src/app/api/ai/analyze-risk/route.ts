import { NextRequest, NextResponse } from "next/server";
import { aiService } from "@/lib/ai/ai-service";
import { logger } from "@/lib/utils/logger";
import { getErrorMessage } from "@/lib/utils/error-message";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";

export const POST = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

    const { studentId, academicYearId } = await request.json();

    if (!studentId) {
      return NextResponse.json({ error: "studentId requis" }, { status: 400 });
    }

    const result = await aiService.executeGovernance({
      action: "analyze-risk",
      studentId,
      userId: session.user.id,
      userRole: session.user.role,
      schoolId: getActiveSchoolId(session),
      data: { academicYearId },
    });

    return NextResponse.json(result);
  
    } catch (error) {
    logger.error("Error in AI risk analysis:", error);
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? (error as { status: unknown }).status
        : undefined;
    return NextResponse.json(
      { error: getErrorMessage(error, "Erreur lors de l'analyse de risque") },
      { status: typeof status === "number" && status ? status : 500 }
    );
  }

});
