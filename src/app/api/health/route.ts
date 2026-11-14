import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { storeCircuit } from "@/lib/shared-state/pg";
import { inflightRequests, isShuttingDown } from "@/lib/system/shutdown";

/**
 * GET /api/health — Public health check endpoint
 * Returns system status and database connectivity.
 * Listed in middleware publicApiRoutes — no auth required.
 */
export const GET = createApiHandler(
    async () => {
        const timestamp = new Date().toISOString();

        // Arrêt en cours (Lot 7) : on l'annonce avant de fermer, pour qu'un
        // répartiteur ou une surveillance cesse d'envoyer du trafic ici
        // pendant que les requêtes en cours se terminent.
        if (isShuttingDown()) {
            return NextResponse.json(
                { status: "shutting_down", timestamp, inflight: inflightRequests() },
                { status: 503, headers: { "Retry-After": "30", "Connection": "close" } },
            );
        }

        try {
            // Verify database connectivity
            await prisma.$queryRaw`SELECT 1`;
            // État partagé (limites, coupe-circuits) dans PostgreSQL : dégradé
            // tant que son coupe-circuit est ouvert (repli mémoire local).
            const sharedState: "connected" | "degraded" = storeCircuit.isOpen() ? "degraded" : "connected";

            return NextResponse.json({
                status: "ok",
                timestamp,
                database: "connected",
                cache: "memory",
                sharedState,
                checks: {
                    database: "healthy",
                    sharedState: sharedState === "connected" ? "healthy" : "warning",
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
