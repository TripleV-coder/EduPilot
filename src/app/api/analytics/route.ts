import { NextRequest, NextResponse } from "next/server";
import { analyticsService } from "@/lib/analytics/service";
import { generateCacheKey, withCache, CACHE_TTL_MEDIUM } from "@/lib/api/cache-helpers";
import { withHttpCache } from "@/lib/api/cache-http";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";
import { createApiHandler } from "@/lib/api/api-helpers";

const ANALYTICS_ALLOWED_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];

export const GET = createApiHandler(
    async (req: NextRequest, { session }) => {
        const schoolId = getActiveSchoolId(session);
        if (!schoolId) {
            return NextResponse.json({ error: "École introuvable" }, { status: 400 });
        }

        const url = new URL(req.url);
        const cacheKey = generateCacheKey(url.pathname, url.searchParams, session.user.id);

        const handler = async () => {
            const type = url.searchParams.get("type") || "overview";
            switch (type) {
                case "overview": {
                    const [stats, userStats] = await Promise.all([
                        analyticsService.getSchoolStats(schoolId),
                        analyticsService.getUserStats(session.user.id),
                    ]);
                    return NextResponse.json({ ...stats, userStats });
                }
                case "grades": {
                    const classId = url.searchParams.get("classId") || undefined;
                    const grades = await analyticsService.getGradeDistribution(
                        schoolId,
                        classId
                    );
                    return NextResponse.json(grades);
                }
                case "activity": {
                    const activity = await analyticsService.getRecentActivity(
                        schoolId
                    );
                    return NextResponse.json(activity);
                }
                default:
                    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
            }
        };

        try {
            const response = await withCache(
                handler as () => Promise<NextResponse<Record<string, unknown>>>,
                { ttl: CACHE_TTL_MEDIUM, key: cacheKey }
            );
            return withHttpCache(response, req, { private: true, maxAge: CACHE_TTL_MEDIUM, staleWhileRevalidate: 30 });
        } catch (error) {
            logger.error("Analytics failed", error instanceof Error ? error : new Error(String(error)), {
                module: "api/analytics",
                userId: session.user.id,
                schoolId,
            });
            return NextResponse.json({ error: "Analytics failed" }, { status: 500 });
        }
    }, { allowedRoles: ANALYTICS_ALLOWED_ROLES });
