import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/health — Public health check endpoint
 * Returns system status and database connectivity.
 * Listed in middleware publicApiRoutes — no auth required.
 */
export async function GET() {
    const timestamp = new Date().toISOString();

    try {
        // Verify database connectivity
        await prisma.$queryRaw`SELECT 1`;

        return NextResponse.json({
            status: "ok",
            timestamp,
            database: "connected",
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
}
