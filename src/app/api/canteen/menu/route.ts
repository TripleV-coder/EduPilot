import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canteenService } from "@/lib/canteen/service";
import { generateCacheKey, withCache, CACHE_TTL_MEDIUM } from "@/lib/api/cache-helpers";
import { withHttpCache } from "@/lib/api/cache-http";
import { logger } from "@/lib/utils/logger";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const cacheKey = generateCacheKey(url.pathname, url.searchParams, session.user.id);

    try {
        const response = await withCache(
            async () => {
                const dateParam = url.searchParams.get("date");
                const date = dateParam ? new Date(dateParam) : new Date();
                const menu = await canteenService.getMenu(session.user.schoolId!, date);
                return NextResponse.json(menu || { message: "No menu found for this date" });
            },
            { ttl: CACHE_TTL_MEDIUM, key: cacheKey }
        );
        return withHttpCache(response, req, { private: true, maxAge: CACHE_TTL_MEDIUM, staleWhileRevalidate: 30 });
    } catch (error) {
        logger.error("Menu fetch failed", error instanceof Error ? error : new Error(String(error)), {
            module: "api/canteen/menu",
            schoolId: session.user.schoolId,
        });
        return NextResponse.json({ error: "Failed to fetch menu" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.schoolId || !["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(session.user.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { date, starter, mainCourse, dessert } = body;

        if (!date) return NextResponse.json({ error: "Date is required" }, { status: 400 });

        const menu = await canteenService.upsertMenu(session.user.schoolId, new Date(date), {
            starter,
            mainCourse,
            dessert
        });

        return NextResponse.json(menu);
    } catch (error) {
        logger.error("Menu upsert failed", error instanceof Error ? error : new Error(String(error)), {
            module: "api/canteen/menu",
            schoolId: session.user.schoolId,
        });
        return NextResponse.json({ error: "Failed to update menu" }, { status: 500 });
    }
}
