import { NextRequest, NextResponse } from "next/server";
import { Prisma, type SchoolType, type SchoolLevel } from "@prisma/client";
import prisma from "@/lib/prisma";

import { createApiHandler } from "@/lib/api/api-helpers";
/** Champs strictement publics exposés dans l'annuaire (jamais d'effectifs/finances). */
const PUBLIC_SELECT = {
    id: true,
    code: true,
    name: true,
    logo: true,
    coverImage: true,
    motto: true,
    city: true,
    region: true,
    type: true,
    offeredLevels: true,
} satisfies Prisma.SchoolSelect;

const SCHOOL_TYPES: SchoolType[] = ["PUBLIC", "PRIVATE", "RELIGIOUS", "INTERNATIONAL"];
const SCHOOL_LEVELS: SchoolLevel[] = ["PRIMARY", "SECONDARY_COLLEGE", "SECONDARY_LYCEE", "MIXED"];

const PAGE_SIZE = 12;

/**
 * GET /api/public/schools — annuaire public filtrable (aucune authentification).
 * Ne renvoie que les établissements publiés (isPublic) et actifs.
 */
export const GET = createApiHandler(
    async (request, context) => {

    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const region = url.searchParams.get("region")?.trim() ?? "";
    const typeParam = url.searchParams.get("type")?.trim() ?? "";
    const levelParam = url.searchParams.get("level")?.trim() ?? "";
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

    const where: Prisma.SchoolWhereInput = {
        isPublic: true,
        isActive: true,
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
        ...(region ? { region: { equals: region, mode: "insensitive" } } : {}),
        ...(SCHOOL_TYPES.includes(typeParam as SchoolType) ? { type: typeParam as SchoolType } : {}),
        ...(SCHOOL_LEVELS.includes(levelParam as SchoolLevel)
            ? { offeredLevels: { has: levelParam as SchoolLevel } }
            : {}),
    };

    const [total, schools, regions] = await Promise.all([
        prisma.school.count({ where }),
        prisma.school.findMany({
            where,
            select: PUBLIC_SELECT,
            orderBy: { name: "asc" },
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
        }),
        // Régions distinctes pour alimenter le filtre.
        prisma.school.findMany({
            where: { isPublic: true, isActive: true, region: { not: null } },
            select: { region: true },
            distinct: ["region"],
            orderBy: { region: "asc" },
        }),
    ]);

    return NextResponse.json({
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
        regions: regions.map((r) => r.region).filter(Boolean),
        schools,
    });
    },
    { requireAuth: false },
);

