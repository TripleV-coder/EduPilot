import { NextRequest, NextResponse } from "next/server";
import { canteenService } from "@/lib/canteen/service";
import { generateCacheKey, withCache, CACHE_TTL_MEDIUM } from "@/lib/api/cache-helpers";
import { withHttpCache } from "@/lib/api/cache-http";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";

export const GET = createApiHandler(async (request, context) => {
        const session = context.session;
    if (!session.user.schoolId) return NextResponse.json({ error: "Aucun établissement associé" }, { status: 403 });

    const url = new URL(request.url);
    const cacheKey = generateCacheKey(url.pathname, url.searchParams, session.user.id);

    try {
        const response = await withCache(
            async () => {
                const dateParam = url.searchParams.get("date");
                const date = dateParam ? new Date(dateParam) : new Date();
                const menu = await canteenService.getMenu(getActiveSchoolId(session)!, date);
                return NextResponse.json(menu || { message: "No menu found for this date" });
            },
            { ttl: CACHE_TTL_MEDIUM, key: cacheKey }
        );
        return withHttpCache(response, request, { private: true, maxAge: CACHE_TTL_MEDIUM, staleWhileRevalidate: 30 });
    } catch (error) {
        logger.error("Menu fetch failed", error instanceof Error ? error : new Error(String(error)), {
            module: "api/canteen/menu",
            schoolId: getActiveSchoolId(session),
        });
        return NextResponse.json({ error: "Failed to fetch menu" }, { status: 500 });
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
        return NextResponse.json({ error: "Failed to update menu" }, { status: 500 });
    }

}, { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] });
