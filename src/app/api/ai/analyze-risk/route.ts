import { NextResponse } from "next/server";
import { aiService } from "@/lib/ai/ai-service";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";

/** Erreur du service IA (message destiné à l'utilisateur), reconnue sans dépendre de la classe. */
function isAIServiceError(error: unknown): error is { message: string; status: number } {
    return error instanceof Error && error.name === "AIServiceError" && typeof (error as { status?: unknown }).status === "number";
}

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
    logger.error("Error in AI risk analysis:", error as Error);
    // Seules les erreurs du service IA (droits, élève introuvable…) sont montrées telles quelles.
    if (isAIServiceError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erreur lors de l'analyse de risque" }, { status: 500 });
  }

});
