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
import { enforceDataRetentionPolicies } from "@/lib/security/retention";
import { logger } from "@/lib/utils/logger";
import { createApiHandler } from "@/lib/api/api-helpers";
import { verifyCronSecret } from "@/lib/security/cron-auth";
import { runAsSystem } from "@/lib/db/db-context";

// requireAuth: false (audit N2) : un cron n'a pas de session ; le garde par
// défaut répondait 401 avant même le contrôle du secret. La route étant aussi
// ouverte au middleware (H2), le second facteur est vérifié ici.
export const POST = createApiHandler(async (request, context) => {
    const session = context.session;
    const cronAuthorized = verifyCronSecret(request.headers.get("authorization")) === "ok";
    const superAdminAuthorized =
        session?.user?.role === "SUPER_ADMIN" &&
        (!session.user.isTwoFactorEnabled || session.user.isTwoFactorAuthenticated === true);

    if (!cronAuthorized && !superAdminAuthorized) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    try {
        logger.info("Démarrage enforcement rétention RGPD", { module: "api/system/retention" });

        // Appelant vérifié : la rétention porte sur tous les établissements,
        // contexte système déclaré (audit M2).
        const results = await runAsSystem("cron:retention", () => enforceDataRetentionPolicies());

        const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);

        // N57 : une règle en échec n'est plus avalée ; elle est comptée et signalée.
        const errors = results.filter((r) => r.error).length;
        const summary = { module: "api/system/retention", totalDeleted, policiesProcessed: results.length, errors };
        if (errors > 0) logger.warn("Enforcement rétention RGPD terminé avec des erreurs", summary);
        else logger.info("Enforcement rétention RGPD terminé", summary);

        return NextResponse.json({
            success: errors === 0,
            executedAt: new Date().toISOString(),
            totalDeleted,
            errors,
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
}, { requireAuth: false });
