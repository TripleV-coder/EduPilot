import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { aiService } from "@/lib/ai/ai-service";
import { logger } from "@/lib/utils/logger";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { studentId, academicYearId } = await request.json();

    if (!studentId) {
      return NextResponse.json({ error: "studentId requis" }, { status: 400 });
    }

    const result = await aiService.executeGovernance({
      action: "analyze-risk",
      studentId,
      userId: session.user.id,
      userRole: session.user.role as any,
      schoolId: session.user.schoolId,
      data: { academicYearId },
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error("Error in AI risk analysis:", error);
    return NextResponse.json(
      { error: (error as any).message || "Erreur lors de l'analyse de risque" },
      { status: (error as any).status || 500 }
    );
  }
}
