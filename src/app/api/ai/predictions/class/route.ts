import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateClassPredictions } from "@/lib/services/ai-predictive";
import { logger } from "@/lib/utils/logger";

/**
 * POST /api/ai/predictions/class
 * Générer des prédictions IA pour une classe entière
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const { classId } = body;

    if (!classId) {
      return NextResponse.json(
        { error: "classId est requis" },
        { status: 400 }
      );
    }

    // Vérifier que la classe appartient à l'école
    if (session.user.role !== "SUPER_ADMIN") {
      const classData = await prisma.class.findUnique({
        where: { id: classId },
        select: { schoolId: true },
      });

      if (!classData || classData.schoolId !== session.user.schoolId) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    // Générer les prédictions
    const predictions = await generateClassPredictions(classId);

    return NextResponse.json(predictions);
  } catch (error) {
    logger.error(" generating class predictions:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la génération des prédictions" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/predictions/class
 * Obtenir les prédictions pour une classe
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");

    if (!classId) {
      return NextResponse.json(
        { error: "classId est requis" },
        { status: 400 }
      );
    }

    // Vérifier l'accès
    if (session.user.role !== "SUPER_ADMIN") {
      const classData = await prisma.class.findUnique({
        where: { id: classId },
        select: { schoolId: true },
      });

      if (!classData || classData.schoolId !== session.user.schoolId) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    // Générer les prédictions en temps réel
    const predictions = await generateClassPredictions(classId);

    return NextResponse.json(predictions);
  } catch (error) {
    logger.error(" fetching class predictions:", error as Error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
