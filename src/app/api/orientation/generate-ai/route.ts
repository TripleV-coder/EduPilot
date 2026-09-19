import { NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";
import { aiService, OrientationRecommendation } from "@/lib/ai/ai-service";
import { createApiHandler } from "@/lib/api/api-helpers";

/** Erreur du service IA (message destiné à l'utilisateur), reconnue sans dépendre de la classe. */
function isAIServiceError(error: unknown): error is { message: string; status: number } {
    return error instanceof Error && error.name === "AIServiceError" && typeof (error as { status?: unknown }).status === "number";
}

export const POST = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

        const body = await request.json();
        const { studentId, academicYearId } = body;

        if (!studentId || !academicYearId) {
            return NextResponse.json({ error: "studentId et academicYearId requis" }, { status: 400 });
        }

        const result = await aiService.executeGovernance<OrientationRecommendation>({
            action: "recommend-orientation",
            userId: session.user.id,
            userRole: session.user.role,
            studentId,
            data: { academicYearId }
        });

        if (!result.success) {
            return NextResponse.json({ error: "L'analyse IA a échoué" }, { status: 500 });
        }

        return NextResponse.json({
            studentId,
            recommendations: [
                {
                    series: result.data.series,
                    justification: result.data.justification,
                    score: result.confidence * 100
                },
                ...(result.recommendations || []).map((alt: string) => ({
                    series: alt,
                    score: (result.confidence * 100) - 10,
                    justification: "Alternative suggérée par l'IA"
                }))
            ],
            engine: result.data.engine // optional flag
        });

    
    } catch (error) {
        logger.error("AI Orientation Generation:", error);
        // Seules les erreurs du service IA portent un message destiné à l'utilisateur.
        if (isAIServiceError(error)) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: "Erreur lors de la génération de l'avis IA" }, { status: 500 });
    }

}, { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] });
