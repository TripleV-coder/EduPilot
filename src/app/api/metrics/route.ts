/**
 * GET /api/metrics — métriques Prometheus de la protection contre la surcharge.
 *
 * Accès : `Authorization: Bearer <METRICS_TOKEN>` (comparaison en temps
 * constant). Sans METRICS_TOKEN la route n'existe pas (404) : rien n'est
 * exposé par défaut. Aucune donnée personnelle, seulement des compteurs.
 *
 * Exposé : taille de la file d'envoi et seuils, requêtes reçues et refusées
 * par motif (taux de rejet = rate(rejected) / rate(requests)), état de chaque
 * coupe-circuit et ses transitions.
 */
import { CIRCUITS, getCircuitBreaker } from "@/lib/resilience/circuit-breaker";
import { queueSettings } from "@/lib/resilience/config";
import { renderPrometheus, type CircuitStateName, type GaugeSnapshot } from "@/lib/resilience/metrics";
import { getJobQueueStats } from "@/lib/jobs/queue";
import { verifyCronSecret } from "@/lib/security/cron-auth";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

async function queueGauge(): Promise<GaugeSnapshot["queue"]> {
    try {
        const stats = await getJobQueueStats();
        const { maxSize, rejectRatio } = queueSettings();
        const oldest = stats.oldestPendingRunAt;
        return {
            pending: stats.PENDING,
            running: stats.RUNNING,
            failed: stats.FAILED,
            capacity: maxSize,
            rejectAt: Math.floor(maxSize * rejectRatio),
            oldestPendingSeconds: oldest ? Math.max(0, Math.round((Date.now() - oldest.getTime()) / 1000)) : 0,
        };
    } catch (error) {
        // Base indisponible : les autres métriques restent lisibles.
        logger.warn("[metrics] état de la file illisible", { module: "api/metrics", reason: (error as Error).message });
        return null;
    }
}

async function circuitGauges(): Promise<GaugeSnapshot["circuits"]> {
    return Promise.all(
        Object.values(CIRCUITS).map(async (name) => {
            const state: CircuitStateName = await getCircuitBreaker(name).state().catch(() => "closed" as const);
            return { name, state };
        }),
    );
}

export async function GET(request: Request): Promise<Response> {
    const access = verifyCronSecret(request.headers.get("authorization"), process.env.METRICS_TOKEN);
    if (access === "not-configured") return new Response("Not Found", { status: 404 });
    if (access === "invalid") {
        return new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
    }

    const [queue, circuits] = await Promise.all([queueGauge(), circuitGauges()]);
    return new Response(renderPrometheus({ queue, circuits }), {
        headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8", "Cache-Control": "no-store" },
    });
}
