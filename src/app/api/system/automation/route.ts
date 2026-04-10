import { NextRequest, NextResponse } from "next/server";
import { automationService } from "@/lib/services/automation.service";
import { logger } from "@/lib/utils/logger";

/**
 * API Trigger for Automated Maintenance Tasks
 * Secure via CRON_SECRET environment variable
 */
export async function POST(req: NextRequest) {
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
            error: (error as Error).message 
        }, { status: 500 });
    }
}

// Allow GET for simple triggers if configured (optional, POST is preferred)
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const cronSecret = process.env.CRON_SECRET;

    if (key !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await automationService.runDailyMaintenance();
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
