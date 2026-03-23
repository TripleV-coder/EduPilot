/**
 * POST /api/system/retention
 *
 * Endpoint d'enforcement des politiques de rétention RGPD.
 * À appeler via un cron job (PM2 cron, n8n scheduler, Vercel Cron, etc.)
 * selon la fréquence souhaitée (ex: chaque nuit à 02:00).
 *
 * Sécurité :
 * - Accessible uniquement par SUPER_ADMIN en session, OU
 * - Via un header Authorization: Bearer <CRON_SECRET> (appel automatisé)
 *
 * Variable d'environnement requise pour les appels automatisés :
 *   CRON_SECRET — chaîne aléatoire secrète partagée avec le scheduler
 *   Générer avec : openssl rand -hex 32
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { enforceDataRetentionPolicies } from "@/lib/security/rgpd";
import { logger } from "@/lib/utils/logger";

export async function POST(req: NextRequest) {
    // Authentification : session SUPER_ADMIN OU CRON_SECRET
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    let authorized = false;

    if (cronSecret && bearerToken === cronSecret) {
        authorized = true;
    } else {
        const session = await auth();
        if (session?.user?.role === "SUPER_ADMIN") {
            authorized = true;
        }
    }

    if (!authorized) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    try {
        logger.info("Démarrage enforcement rétention RGPD", { module: "api/system/retention" });

        const results = await enforceDataRetentionPolicies();

        const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);

        logger.info("Enforcement rétention RGPD terminé", {
            module: "api/system/retention",
            totalDeleted,
            policiesProcessed: results.length,
        });

        return NextResponse.json({
            success: true,
            executedAt: new Date().toISOString(),
            totalDeleted,
            details: results,
        });
    } catch (error) {
        logger.error(
            "Erreur enforcement rétention RGPD",
            error instanceof Error ? error : new Error(String(error)),
            { module: "api/system/retention" }
        );
        return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
    }
}
