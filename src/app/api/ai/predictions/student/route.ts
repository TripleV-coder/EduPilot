import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import prisma from "@/lib/prisma";
import { getStudentPredictions } from "@/lib/services/ai-predictive";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";
import { aiStudentAccessDenied } from "@/lib/ai/student-access";

/**
 * Contrôle commun au POST et au GET : élève de l'école active (sauf
 * SUPER_ADMIN), puis règle d'accès IA par rôle (direction : école ;
 * enseignant : ses classes ; parent : ses enfants ; élève : lui-même).
 *
 * Avant, le GET ne vérifiait l'accès que pour l'élève et le parent : tout autre
 * compte connecté, de n'importe quelle école, lisait les prédictions de
 * n'importe quel élève.
 */
async function predictionAccessError(session: Session, studentId: string): Promise<NextResponse | null> {
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    select: { id: true, userId: true, user: { select: { schoolId: true } } },
  });
  if (!student) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (session.user.role !== "SUPER_ADMIN" && student.user.schoolId !== getActiveSchoolId(session)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const denied = await aiStudentAccessDenied(session, student, { allowFamily: true });
  return denied ? NextResponse.json({ error: denied }, { status: 403 }) : null;
}

/**
 * POST /api/ai/predictions/student
 * Générer des prédictions IA pour un élève
 */
export const POST = createApiHandler(async (request, context) => {
  try {
    const session = context.session;
    const body = await request.json().catch(() => ({}));
    const studentId = typeof body?.studentId === "string" ? body.studentId : "";

    if (!studentId) {
      return NextResponse.json({ error: "studentId est requis" }, { status: 400 });
    }

    const accessError = await predictionAccessError(session, studentId);
    if (accessError) return accessError;

    const result = await getStudentPredictions(studentId);
    return NextResponse.json(result);
  } catch (error) {
    logger.error(" generating student predictions:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la génération des prédictions" },
      { status: 500 }
    );
  }
});

/**
 * GET /api/ai/predictions/student
 * Obtenir les prédictions existantes (si sauvegardées)
 */
export const GET = createApiHandler(async (request, context) => {
  try {
    const session = context.session;
    const studentId = new URL(request.url).searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json({ error: "studentId est requis" }, { status: 400 });
    }

    const accessError = await predictionAccessError(session, studentId);
    if (accessError) return accessError;

    const result = await getStudentPredictions(studentId);
    return NextResponse.json(result);
  } catch (error) {
    logger.error(" fetching predictions:", error as Error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
});
