import { NextRequest, NextResponse } from "next/server";
import { automationService } from "@/lib/services/automation.service";
import { logger } from "@/lib/utils/logger";

/**
 * API Trigger for Automated Maintenance Tasks
 * Secured via the CRON_SECRET environment variable.
 *
 * - Vercel Cron Jobs invoke this path with a **GET** request and inject the
 *   `Authorization: Bearer <CRON_SECRET>` header automatically (see vercel.json).
 * - External schedulers may also POST with the same bearer token.
 * Both verbs share the exact same secured handler.
 */

/** Vercel functions can run longer than the daily maintenance sweep needs. */
export const maxDuration = 300;

async function handleMaintenance(req: NextRequest) {
    const authHeader = req.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
        logger.error("CRON_SECRET is not defined in environment variables");
        return NextResponse.json({ error: "Configuration Error" }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await automationService.runDailyMaintenance();
        return NextResponse.json(result);
    } catch (error) {
        logger.error("Automation Route Error:", error as Error);
        return NextResponse.json({
            success: false,
            error: process.env.NODE_ENV === "production" ? "Internal error" : (error as Error).message
        }, { status: 500 });
    }
}

// Vercel Cron uses GET; manual/external triggers may use POST.
export const GET = handleMaintenance;
export const POST = handleMaintenance;
