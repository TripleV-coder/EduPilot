import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { gamificationService } from "@/lib/gamification/service";
import { generateCacheKey, withCache, CACHE_TTL_MEDIUM } from "@/lib/api/cache-helpers";
import { withHttpCache } from "@/lib/api/cache-http";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const cacheKey = generateCacheKey(url.pathname, url.searchParams, session.user.id);

    try {
        const response = await withCache(
            async () => {
                const leaderboard = await gamificationService.getLeaderboard(getActiveSchoolId(session)!);
                return NextResponse.json(leaderboard);
            },
            { ttl: CACHE_TTL_MEDIUM, key: cacheKey }
        );
        return withHttpCache(response, req, { private: true, maxAge: CACHE_TTL_MEDIUM, staleWhileRevalidate: 30 });
    } catch (error) {
        logger.error("Leaderboard failed", error instanceof Error ? error : new Error(String(error)), {
            module: "api/gamification/leaderboard",
            schoolId: getActiveSchoolId(session),
        });
        return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
    }
}
