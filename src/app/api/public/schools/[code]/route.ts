import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

import { createApiHandler } from "@/lib/api/api-helpers";
/**
 * GET /api/public/schools/[code] — fiche publique d'un établissement (sans auth).
 * 404 (et non 403) si l'établissement n'existe pas OU n'est pas publié, afin de
 * ne pas révéler l'existence d'une école non publiée.
 */
export const GET = createApiHandler(
    async (request, context) => {

    const { code } = await context.params;

    const school = await prisma.school.findFirst({
        where: { code, isPublic: true, isActive: true },
        select: {
            name: true,
            code: true,
            logo: true,
            coverImage: true,
            motto: true,
            publicDescription: true,
            city: true,
            region: true,
            type: true,
            offeredLevels: true,
            primaryColor: true,
            email: true,
            publicPhone: true,
        },
    });

    if (!school) {
        return NextResponse.json({ error: "Établissement introuvable" }, { status: 404 });
    }

    return NextResponse.json({ school });
    },
    { requireAuth: false },
);

