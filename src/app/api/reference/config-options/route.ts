import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/utils/logger";
import { auth } from "@/lib/auth";
// Removed authOptions import

/**
 * GET /api/reference/config-options
 * Liste les options configurables (relationship types, allergy severity, etc.)
 *
 * Query params:
 * - category: RELATIONSHIP_TYPE, ALLERGY_SEVERITY, BLOOD_TYPE, etc.
 * - schoolId: Filtre par école (optionnel, retourne aussi options globales)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const schoolId = searchParams.get("schoolId") || session.user.schoolId;

    if (!category) {
      return NextResponse.json(
        { error: "Paramètre 'category' requis" },
        { status: 400 }
      );
    }

    // Récupérer options globales + options spécifiques à l'école
    const where: Prisma.ConfigOptionWhereInput = {
      category,
      isActive: true,
      OR: [
        { schoolId: null }, // Options globales
        ...(schoolId ? [{ schoolId }] : []), // Options de l'école
      ],
    };

    const options = await prisma.configOption.findMany({
      where,
      orderBy: [
        { order: "asc" },
        { label: "asc" },
      ],
      select: {
        id: true,
        code: true,
        label: true,
        description: true,
        metadata: true,
        schoolId: true,
      },
    });

    return NextResponse.json(options);
  } catch (error) {
    logger.error("Erreur lors de la récupération des options:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reference/config-options
 * Créer une nouvelle option de configuration
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Seuls SUPER_ADMIN peut créer des options globales
    // Les admins d'école peuvent créer des options pour leur école
    const body = await request.json();
    const { category, code, label, description, order, metadata, schoolId } = body;

    if (!category || !code || !label) {
      return NextResponse.json(
        { error: "Catégorie, code et label requis" },
        { status: 400 }
      );
    }

    // Vérification des permissions
    if (schoolId && schoolId !== session.user.schoolId) {
      if (session.user.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
      }
    }

    if (!schoolId && !["SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Seul SUPER_ADMIN peut créer des options globales" },
        { status: 403 }
      );
    }

    const option = await prisma.configOption.create({
      data: {
        category,
        code,
        label,
        description,
        order: order || 0,
        metadata: metadata || undefined,
        schoolId: schoolId || null,
      },
    });

    return NextResponse.json(option, { status: 201 });
  } catch (error) {
    logger.error("Erreur lors de la création de l'option:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Cette option existe déjà" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
