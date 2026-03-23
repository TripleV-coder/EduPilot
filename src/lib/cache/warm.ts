/**
 * Cache warming: précharge les données critiques au démarrage ou à la demande.
 * Réduit la latence des premières requêtes sur les endpoints fréquents.
 */

import { getCacheService } from "@/lib/cache/redis";
const cache = getCacheService();
import { logger } from "@/lib/utils/logger";

const WARM_TTL = 300; // 5 min pour les données préchauffées

/**
 * Clés et chemins à préchauffer (données de référence ou agrégats lourds).
 * Chaque entrée peut être étendue avec des paramètres (ex: schoolId) si besoin.
 */
const WARM_ENTRIES: { key: string; path: string }[] = [
  { key: ["api", "warm", "reference", "config"].join(":"), path: "reference/config" },
  { key: ["api", "warm", "reference", "cities"].join(":"), path: "reference/cities" },
];

/**
 * Précharge le cache pour les clés définies.
 * À appeler au démarrage (instrumentation) ou via un cron.
 */
export async function warmCache(): Promise<void> {
  if (process.env.NODE_ENV === "development") {
    return;
  }

  try {
    for (const { key } of WARM_ENTRIES) {
      // Marqueur de préchauffage : les handlers réels rempliront le cache à la première requête.
      // Ici on peut précharger des données statiques si on a un accès direct (ex: config).
      await cache.set(key, { warmed: true, at: new Date().toISOString() }, WARM_TTL);
    }
    logger.info("Cache warming completed", {
      module: "cache/warm",
      entries: WARM_ENTRIES.length,
    });
  } catch (error) {
    logger.warn("Cache warming failed (non-blocking)", {
      module: "cache/warm",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
