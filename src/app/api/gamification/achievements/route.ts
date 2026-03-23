import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { gamificationService } from "@/lib/gamification/service";
import { generateCacheKey, withCache, CACHE_TTL_MEDIUM } from "@/lib/api/cache-helpers";
import { withHttpCache } from "@/lib/api/cache-http";
import { logger } from "@/lib/utils/logger";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const cacheKey = generateCacheKey(url.pathname, url.searchParams, session.user.id);

    try {
        const response = await withCache(
            async () => {
                const achievements = await gamificationService.getUserAchievements(session.user.id);
                return NextResponse.json(achievements);
            },
            { ttl: CACHE_TTL_MEDIUM, key: cacheKey }
        );
        return withHttpCache(response, req, { private: true, maxAge: CACHE_TTL_MEDIUM, staleWhileRevalidate: 30 });
    } catch (error) {
        logger.error("Achievements fetch failed", error instanceof Error ? error : new Error(String(error)), {
            module: "api/gamification/achievements",
            userId: session.user.id,
        });
        return NextResponse.json({ error: "Failed to fetch achievements" }, { status: 500 });
    }
}
