import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { auth } from "@/lib/auth";
// Removed authOptions import

import { Prisma } from "@prisma/client";

/**
 * GET /api/reference/nationalities
 * Liste toutes les nationalités (pour dropdowns)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    const where: Prisma.NationalityWhereInput = {
      isActive: true,
    };

    if (search) {
      where.name = {
        contains: search,
        mode: "insensitive",
      };
    }

    const nationalities = await prisma.nationality.findMany({
      where,
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    return NextResponse.json(nationalities);
  } catch (error) {
    logger.error("Erreur lors de la récupération des nationalités:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reference/nationalities
 * Créer une nouvelle nationalité (SUPER_ADMIN uniquement)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const { name, code } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: "Nom et code ISO requis" },
        { status: 400 }
      );
    }

    const nationality = await prisma.nationality.create({
      data: {
        name,
        code: code.toUpperCase(),
      },
    });

    return NextResponse.json(nationality, { status: 201 });
  } catch (error) {
    logger.error("Erreur lors de la création de la nationalité:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Cette nationalité existe déjà" },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
