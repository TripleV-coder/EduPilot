import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStudentPredictions } from "@/lib/services/ai-predictive";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";

/**
 * POST /api/ai/predictions/student
 * Générer des prédictions IA pour un élève
 */
export const POST = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

    const body = await request.json();
    const { studentId } = body;

    if (!studentId) {
      return NextResponse.json(
        { error: "studentId est requis" },
        { status: 400 }
      );
    }

    // Vérifier les permissions
    if (session.user.role === "STUDENT") {
      // L'élève ne peut voir que ses propres prédictions
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      if (!studentProfile || studentProfile.id !== studentId) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    } else if (session.user.role === "PARENT") {
      // Le parent ne peut voir que les prédictions de ses enfants
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: {
          parentStudents: {
            select: { studentId: true },
          },
        },
      });

      if (
        !parentProfile ||
        !parentProfile.parentStudents.some((c) => c.studentId === studentId)
      ) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    } else if (
      !["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"].includes(
        session.user.role
      )
    ) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Vérifier que l'élève appartient à la même école
    if (session.user.role !== "SUPER_ADMIN") {
      const student = await prisma.studentProfile.findUnique({
        where: { id: studentId },
        include: { user: true },
      });

      if (!student || student.user.schoolId !== getActiveSchoolId(session)) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    // Générer les prédictions
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

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json(
        { error: "studentId est requis" },
        { status: 400 }
      );
    }

    // Vérifier les permissions (même logique que POST)
    if (session.user.role === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      if (!studentProfile || studentProfile.id !== studentId) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    } else if (session.user.role === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: {
          parentStudents: {
            select: { studentId: true },
          },
        },
      });

      if (
        !parentProfile ||
        !parentProfile.parentStudents.some((c) => c.studentId === studentId)
      ) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    // Générer les prédictions en temps réel
    const result = await getStudentPredictions(studentId);

    return NextResponse.json(result);
  
    } catch (error) {
    logger.error(" fetching predictions:", error as Error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

});
