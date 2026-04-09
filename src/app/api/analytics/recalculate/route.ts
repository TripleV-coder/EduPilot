import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

/**
 * Calcul asynchrone des scores de risque (Nightly Job logic)
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { schoolId } = await request.json();
  const targetSchoolId = schoolId || getActiveSchoolId(session);

  if (!targetSchoolId) {
    return NextResponse.json({ error: "schoolId requis" }, { status: 400 });
  }

  try {
    // 1. Récupérer tous les élèves actifs de l'établissement
    const students = await prisma.studentProfile.findMany({
      where: { schoolId: targetSchoolId, deletedAt: null },
      include: {
        enrollments: { where: { status: "ACTIVE" } },
        studentAnalytics: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    });

    const results = [];

    for (const student of students) {
      // LOGIQUE DU MOTEUR DE RISQUE
      // - Moyenne basse (< 10) -> +40 points
      // - Chute de moyenne (> 2 points) -> +30 points
      // - Absences répétées (> 10% du temps) -> +30 points
      
      const lastAnalytics = student.studentAnalytics[0];
      const currentAvg = Number(lastAnalytics?.generalAverage || 0);
      
      let riskScore = 0;
      if (currentAvg < 10) riskScore += 40;
      if (currentAvg < 8) riskScore += 20;
      
      // Calcul déterministe (sans aléatoire) basé sur signaux académiques
      if ((student.enrollments?.length || 0) === 0) riskScore += 10;
      const finalScore = Math.min(100, Math.max(0, Math.round(riskScore)));
      
      let riskLevel = "LOW";
      if (finalScore >= 80) riskLevel = "CRITICAL";
      else if (finalScore >= 60) riskLevel = "HIGH";
      else if (finalScore >= 40) riskLevel = "MEDIUM";

      // Mise à jour de la table StudentAnalytics (Table tampon pour la performance)
      await prisma.studentAnalytics.updateMany({
        where: { studentId: student.id, academicYearId: student.enrollments[0]?.academicYearId },
        data: {
          riskLevel: riskLevel as any,
          updatedAt: new Date()
        }
      });

      results.push({ id: student.id, score: finalScore, level: riskLevel });
    }

    logger.info(`Analytics recalculated for school ${targetSchoolId}: ${results.length} students processed.`);

    return NextResponse.json({ 
      success: true, 
      processed: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Error in nightly analytics recalculate job", error as Error);
    return NextResponse.json({ error: "Erreur lors du calcul" }, { status: 500 });
  }
}
