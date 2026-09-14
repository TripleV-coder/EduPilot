import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import { automationService } from "@/lib/services/automation.service";
import { logger } from "@/lib/utils/logger";
import { verifyCronSecret } from "@/lib/security/cron-auth";
import { acquireJobLease, releaseJobLease } from "@/lib/system/job-lease";
import { runInBackground } from "@/lib/system/run-in-background";
import { runAsSystem } from "@/lib/db/db-context";

/**
 * API Trigger for Automated Maintenance Tasks
 * Secured via the CRON_SECRET environment variable.
 *
 * - Vercel Cron Jobs invoke this path with a **GET** request and inject the
 *   `Authorization: Bearer <CRON_SECRET>` header automatically (see vercel.json).
 * - External schedulers may also POST with the same bearer token.
 * Both verbs share the exact same secured handler.
 *
 * Audit N8 : la maintenance durait plus que le délai du planificateur, qui
 * réessayait et lançait une 2e exécution concurrente. Elle est désormais
 * acceptée (202) puis exécutée après la réponse, sous un bail exclusif :
 * un déclenchement pendant une exécution reçoit 409.
 */

/** Plafond d'exécution de la tâche de fond sur les hébergements qui l'imposent. */
export const maxDuration = 300;

const LEASE_NAME = "daily-maintenance";
/** Au-delà, le bail d'une exécution interrompue (arrêt brutal) est repris. */
const LEASE_TTL_MS = 60 * 60 * 1000;

async function handleMaintenance(req: NextRequest) {
    const cronAuth = verifyCronSecret(req.headers.get("Authorization"));

    if (cronAuth === "not-configured") {
        logger.error("CRON_SECRET is not defined in environment variables");
        return NextResponse.json({ error: "Configuration Error" }, { status: 500 });
    }

    if (cronAuth !== "ok") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Secret vérifié : la maintenance porte sur tous les établissements,
    // contexte système déclaré (audit M2), conservé par la tâche de fond.
    return runAsSystem("cron:daily-maintenance", startMaintenance);
}

async function startMaintenance() {
    try {
        const token = await acquireJobLease(LEASE_NAME, LEASE_TTL_MS);
        if (!token) {
            return NextResponse.json({ error: "Maintenance déjà en cours" }, { status: 409 });
        }

        runInBackground(async () => {
            try {
                const result = await automationService.runDailyMaintenance();
                logger.info("Maintenance quotidienne terminée", result);
            } catch (error) {
                logger.error("Maintenance quotidienne en échec", error as Error);
            } finally {
                await releaseJobLease(LEASE_NAME, token);
            }
        });

        return NextResponse.json({ accepted: true }, { status: 202 });
    } catch (error) {
        logger.error("Automation Route Error:", error as Error);
        return NextResponse.json({
            success: false,
            error: process.env.NODE_ENV === "production" ? "Internal error" : (error as Error).message
        }, { status: 500 });
    }
}

// Vercel Cron uses GET; manual/external triggers may use POST.
export const GET = createApiHandler(
    async (request) => handleMaintenance(request),
    { requireAuth: false },
);
export const POST = createApiHandler(
    async (request) => handleMaintenance(request),
    { requireAuth: false },
);
