import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/utils/logger";
import { createApiHandler } from "@/lib/api/api-helpers";

/**
 * GET /api/reference/cities
 * Liste toutes les villes (pour dropdowns)
 */
export const GET = createApiHandler(
  async (request, _context) => {
    try {
      const { searchParams } = new URL(request.url);
      const countryCode = searchParams.get("countryCode") || "BJ";
      const region = searchParams.get("region");
      const search = searchParams.get("search");

      const where: Prisma.CityWhereInput = {
        isActive: true,
        countryCode,
      };

      if (region) {
        where.region = region;
      }

      if (search) {
        where.name = {
          contains: search,
          mode: "insensitive",
        };
      }

      const cities = await prisma.city.findMany({
        where,
        orderBy: [
          { population: "desc" }, // Villes les plus peuplées en premier
          { name: "asc" },
        ],
        select: {
          id: true,
          name: true,
          region: true,
          countryCode: true,
        },
      });

      return NextResponse.json(cities);
    } catch (error) {
      logger.error("Erreur lors de la récupération des villes:", error);
      return NextResponse.json(
        { error: "Erreur serveur" },
        { status: 500 }
      );
    }
  },
  {},
);

/**
 * POST /api/reference/cities
 * Créer une nouvelle ville (SUPER_ADMIN uniquement)
 */
export const POST = createApiHandler(
  async (request, _context) => {
    try {
      const body = await request.json();
      const { name, countryCode, region, population } = body;

      if (!name || !countryCode) {
        return NextResponse.json(
          { error: "Nom et code pays requis" },
          { status: 400 }
        );
      }

      const city = await prisma.city.create({
        data: {
          name,
          countryCode: countryCode.toUpperCase(),
          region,
          population: population ? parseInt(population) : null,
        },
      });

      return NextResponse.json(city, { status: 201 });
    } catch (error) {
      logger.error("Erreur lors de la création de la ville:", error);

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return NextResponse.json(
          { error: "Cette ville existe déjà" },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Erreur serveur" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["SUPER_ADMIN"] },
);
