/**
 * Client Redis auto-hébergé (`REDIS_URL`, protocole TCP via ioredis) partagé
 * par la protection contre la surcharge : quotas, coupe-circuits, limites de
 * connexion. C'est lui qui rend ces états communs à plusieurs instances
 * (pods Kubernetes, processus PM2).
 *
 * Sans `REDIS_URL` : `null`, et chaque appelant garde son repli mémoire
 * (installation à un seul processus, décision du 2026-09-12 toujours valable).
 *
 * Une requête ne doit jamais attendre Redis :
 *  - pas de file hors connexion : une commande échoue tout de suite si la
 *    connexion est tombée, au lieu de patienter jusqu'à la reconnexion ;
 *  - tant que la connexion n'est pas prête (démarrage, reconnexion), le client
 *    n'est pas proposé : repli mémoire, sans ouvrir le coupe-circuit ;
 *  - chaque commande est bornée par `tcpRedisCircuit` (200 ms, puis 30 s de
 *    repli mémoire avant un nouvel essai).
 */
import Redis from "ioredis";
import { RedisCircuit } from "@/lib/redis/circuit";
import { logger } from "@/lib/utils/logger";

const globalForRedis = globalThis as unknown as { __edupilotTcpRedis?: { url: string; client: Redis } };

function createClient(url: string): Redis {
    const client = new Redis(url, {
        keyPrefix: "edupilot:",
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 2_000,
        commandTimeout: 500,
        // Reconnexion en tâche de fond, espacée jusqu'à 5 s.
        retryStrategy: (attempt) => Math.min(attempt * 200, 5_000),
    });
    let reported = false;
    client.on("error", (error) => {
        if (reported) return;
        reported = true;
        logger.warn("[Redis] connexion REDIS_URL en échec — quotas et coupe-circuits en mémoire locale", {
            module: "redis",
            reason: error.message,
        });
    });
    client.on("ready", () => {
        if (reported) logger.info("[Redis] connexion REDIS_URL rétablie", { module: "redis" });
        reported = false;
    });
    return client;
}

/** Client prêt à répondre, ou `null` (non configuré, en connexion ou déconnecté). */
export function getTcpRedis(): Redis | null {
    const url = process.env.REDIS_URL;
    if (!url) return null;
    let entry = globalForRedis.__edupilotTcpRedis;
    if (!entry || entry.url !== url) {
        entry?.client.disconnect();
        entry = { url, client: createClient(url) };
        globalForRedis.__edupilotTcpRedis = entry;
    }
    return entry.client.status === "ready" ? entry.client : null;
}

/** Fermeture à l'arrêt du serveur. */
export async function closeTcpRedis(): Promise<void> {
    const entry = globalForRedis.__edupilotTcpRedis;
    if (!entry) return;
    delete globalForRedis.__edupilotTcpRedis;
    await entry.client.quit().catch(() => entry.client.disconnect());
}

/** Coupe-circuit des commandes Redis TCP : au premier dépassement, repli mémoire 30 s. */
export const tcpRedisCircuit = new RedisCircuit({
    onDegraded: (error) =>
        logger.warn("[Redis] lent ou injoignable — quotas et coupe-circuits en mémoire locale pendant 30 s", {
            module: "redis",
            reason: error instanceof Error ? error.message : String(error),
        }),
    onRecovered: () => logger.info("[Redis] rétabli — quotas et coupe-circuits de nouveau partagés", { module: "redis" }),
});
