import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getRedisClient } from "@/lib/cache/redis";

/**
 * GET /api/health — Public health check endpoint
 * Returns system status and database connectivity.
 * Listed in middleware publicApiRoutes — no auth required.
 */
export const GET = createApiHandler(
    async () => {
        const timestamp = new Date().toISOString();

        try {
            // Verify database connectivity
            await prisma.$queryRaw`SELECT 1`;
            const redis = getRedisClient();
            let cache: "connected" | "degraded" | "disabled" = "disabled";
            if (redis) {
                try {
                    await redis.ping();
                    cache = "connected";
                } catch {
                    cache = "degraded";
                }
            }

            return NextResponse.json({
                status: "ok",
                timestamp,
                database: "connected",
                cache,
                checks: {
                    database: "healthy",
                    cache: cache === "connected" ? "healthy" : cache === "degraded" ? "warning" : "disabled",
                },
                version: process.env.npm_package_version || "1.0.0",
            });
        } catch {
            return NextResponse.json(
                {
                    status: "degraded",
                    timestamp,
                    database: "disconnected",
                },
                { status: 503 }
            );
        }
    },
    { requireAuth: false },
);
