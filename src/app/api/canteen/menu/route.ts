import { NextResponse } from "next/server";
import { canteenService } from "@/lib/canteen/service";
import { generateCacheKey, withCache, CACHE_TTL_MEDIUM, cacheScope } from "@/lib/api/cache-helpers";
import { withHttpCache } from "@/lib/api/cache-http";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";

export const GET = createApiHandler(async (request, context) => {
        const session = context.session;
    if (!session.user.schoolId) return NextResponse.json({ error: "Aucun établissement associé" }, { status: 403 });

    const url = new URL(request.url);
    const cacheKey = generateCacheKey(url.pathname, url.searchParams, cacheScope(session));

    try {
        const response = await withCache(
            async () => {
                const dateParam = url.searchParams.get("date");
                const date = dateParam ? new Date(dateParam) : new Date();
                const menu = await canteenService.getMenu(getActiveSchoolId(session)!, date);
                return NextResponse.json(menu || { message: "Aucun menu pour ce jour." });
            },
            { ttl: CACHE_TTL_MEDIUM, key: cacheKey }
        );
        return withHttpCache(response, request, { private: true, maxAge: CACHE_TTL_MEDIUM, staleWhileRevalidate: 30 });
    } catch (error) {
        logger.error("Menu fetch failed", error instanceof Error ? error : new Error(String(error)), {
            module: "api/canteen/menu",
            schoolId: getActiveSchoolId(session),
        });
        return NextResponse.json({ error: "Impossible de charger le menu" }, { status: 500 });
    }

});

export const POST = createApiHandler(async (request, context) => {
        const session = context.session;
    if (!session.user.schoolId) {
      return NextResponse.json({ error: "Aucun établissement associé" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { date, starter, mainCourse, dessert } = body;

        if (!date) return NextResponse.json({ error: "Date is required" }, { status: 400 });

        const menu = await canteenService.upsertMenu(getActiveSchoolId(session) as string, new Date(date), {
            starter,
            mainCourse,
            dessert
        });

        return NextResponse.json(menu);
    } catch (error) {
        logger.error("Menu upsert failed", error instanceof Error ? error : new Error(String(error)), {
            module: "api/canteen/menu",
            schoolId: getActiveSchoolId(session),
        });
        return NextResponse.json({ error: "Impossible de mettre à jour le menu" }, { status: 500 });
    }

}, { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] });

/**
 * DELETE /api/canteen/menu?date=AAAA-MM-JJ — retirer le menu d'un jour. Un menu
 * se corrigeait (nouvel enregistrement à la même date) mais ne se retirait pas.
 */
export const DELETE = createApiHandler(async (request, context) => {
    const schoolId = getActiveSchoolId(context.session);
    if (!schoolId) return NextResponse.json({ error: "Aucun établissement associé" }, { status: 403 });
    const dateParam = new URL(request.url).searchParams.get("date");
    const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? new Date(`${dateParam}T00:00:00.000Z`) : null;
    if (!date || Number.isNaN(date.getTime())) {
        return NextResponse.json({ error: "Indiquez la date du menu (AAAA-MM-JJ)." }, { status: 400 });
    }
    const deleted = await canteenService.deleteMenu(schoolId, date);
    if (!deleted) return NextResponse.json({ error: "Aucun menu à cette date." }, { status: 404 });
    return NextResponse.json({ success: true });
}, { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] });
