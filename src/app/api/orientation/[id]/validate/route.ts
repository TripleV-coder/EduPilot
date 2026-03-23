import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { validateRecommendationSchema } from "@/lib/validations/orientation";
import { logger } from "@/lib/utils/logger";

/**
 * POST /api/orientation/[id]/validate
 * Valider ou rejeter une recommandation d'orientation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const data = validateRecommendationSchema.parse(body);

    // Vérifier que la recommandation existe
    const recommendation = await prisma.orientationRecommendation.findUnique({
      where: { id: id },
      include: {
        orientation: {
          include: {
            student: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!recommendation) {
      return NextResponse.json({ error: "Recommandation non trouvée" }, { status: 404 });
    }

    // Vérifier l'accès (même école)
    if (
      session.user.role !== "SUPER_ADMIN" &&
      recommendation.orientation.student.user.schoolId !== session.user.schoolId
    ) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Mettre à jour la recommandation
    const updated = await prisma.orientationRecommendation.update({
      where: { id: id },
      data: {
        isValidated: data.isValidated,
        validatedById: session.user.id,
        validatedAt: new Date(),
      },
    });

    // Mettre à jour le statut de l'orientation si validation
    if (data.isValidated) {
      await prisma.studentOrientation.update({
        where: { id: recommendation.orientationId },
        data: {
          status: "VALIDATED",
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error(" validating recommendation:", error as Error);
    if (isZodError(error)) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
