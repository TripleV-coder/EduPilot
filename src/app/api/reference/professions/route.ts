import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { auth } from "@/lib/auth";
// Removed authOptions import

/**
 * GET /api/reference/professions
 * Liste toutes les professions (pour dropdowns)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    const where: any = {
      isActive: true,
    };

    if (category) {
      where.category = category;
    }

    if (search) {
      where.name = {
        contains: search,
        mode: "insensitive",
      };
    }

    const professions = await prisma.profession.findMany({
      where,
      orderBy: [
        { category: "asc" },
        { name: "asc" },
      ],
      select: {
        id: true,
        name: true,
        category: true,
        description: true,
      },
    });

    return NextResponse.json(professions);
  } catch (error) {
    logger.error("Erreur lors de la récupération des professions:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reference/professions
 * Créer une nouvelle profession (SUPER_ADMIN uniquement)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const { name, category, description } = body;

    if (!name || !category) {
      return NextResponse.json(
        { error: "Nom et catégorie requis" },
        { status: 400 }
      );
    }

    const profession = await prisma.profession.create({
      data: {
        name,
        category,
        description,
      },
    });

    return NextResponse.json(profession, { status: 201 });
  } catch (error: any) {
    logger.error("Erreur lors de la création de la profession:", error);

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Cette profession existe déjà" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
