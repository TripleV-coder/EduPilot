/**
 * Seuils de la protection contre la surcharge, tous réglables par variable
 * d'environnement (voir `.env.example`, section « Protection contre la surcharge »).
 *
 * Lus à chaque appel et non figés au chargement du module : un test, ou un
 * redémarrage avec une autre configuration, prend effet sans code à changer.
 * Une valeur absente, vide ou invalide retombe sur le défaut (journalisé une
 * fois) plutôt que de désactiver la protection.
 *
 * Chaque variable est lue par son nom littéral dans `process.env` : le contrôle de
 * `.env.example` repère ainsi toutes celles que le code consulte.
 */
import { logger } from "@/lib/utils/logger";

const warned = new Set<string>();

function readNumber(
    name: string,
    raw: string | undefined,
    fallback: number,
    { min, max }: { min: number; max?: number },
): number {
    if (raw === undefined || raw.trim() === "") return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < min || (max !== undefined && value > max)) {
        if (!warned.has(name)) {
            warned.add(name);
            logger.warn(`[resilience] ${name}=${raw} invalide, valeur par défaut ${fallback} utilisée`, { module: "resilience" });
        }
        return fallback;
    }
    return value;
}

/**
 * Développement et CI e2e (`RATE_LIMIT_RELAXED=true`, toute la suite derrière
 * une seule IP) : quotas multipliés par 5. Jamais en production réelle.
 */
function relaxFactor(): number {
    return process.env.NODE_ENV === "development" || process.env.RATE_LIMIT_RELAXED === "true" ? 5 : 1;
}

export interface RateLimitSettings {
    /** Requêtes par minute et par compte connecté (taille du seau = rafale permise). */
    userPerMinute: number;
    /** Requêtes par minute et par adresse IP, tous comptes confondus. */
    ipPerMinute: number;
}

export function rateLimitSettings(): RateLimitSettings {
    const factor = relaxFactor();
    return {
        userPerMinute: readNumber("RATE_LIMIT_USER_PER_MIN", process.env.RATE_LIMIT_USER_PER_MIN, 100, { min: 1 }) * factor,
        // Une école entière sort souvent par une seule IP : 1 000/min laisse
        // passer une salle des profs, pas un robot.
        ipPerMinute: readNumber("RATE_LIMIT_IP_PER_MIN", process.env.RATE_LIMIT_IP_PER_MIN, 1000, { min: 1 }) * factor,
    };
}

export interface QueueSettings {
    /** Nombre maximal d'envois en attente ou en cours dans la file. */
    maxSize: number;
    /** Part de `maxSize` à partir de laquelle les nouveaux envois sont refusés (503). */
    rejectRatio: number;
    /** Envois traités en parallèle par un processeur. */
    concurrency: number;
    /** Envois par minute, tous processeurs confondus (protège les fournisseurs). */
    ratePerMinute: number;
}

export function queueSettings(): QueueSettings {
    return {
        // Défaut dimensionné pour une relance à tout un établissement (≈ 2 envois
        // par famille) ; 1 000 refuserait déjà une école de 500 familles.
        maxSize: readNumber("JOB_QUEUE_MAX", process.env.JOB_QUEUE_MAX, 20_000, { min: 1 }),
        rejectRatio: readNumber("JOB_QUEUE_REJECT_RATIO", process.env.JOB_QUEUE_REJECT_RATIO, 0.8, { min: 0.01, max: 1 }),
        concurrency: readNumber("JOB_WORKER_CONCURRENCY", process.env.JOB_WORKER_CONCURRENCY, 5, { min: 1, max: 50 }),
        ratePerMinute: readNumber("JOB_WORKER_RATE_PER_MIN", process.env.JOB_WORKER_RATE_PER_MIN, 600, { min: 1 }),
    };
}

export interface CircuitSettings {
    /** Échecs consécutifs qui ouvrent le circuit. */
    failureThreshold: number;
    /** Durée d'ouverture avant l'essai unique (demi-ouvert), en millisecondes. */
    openMs: number;
}

export function circuitSettings(): CircuitSettings {
    return {
        failureThreshold: readNumber("CIRCUIT_FAILURE_THRESHOLD", process.env.CIRCUIT_FAILURE_THRESHOLD, 5, { min: 1 }),
        openMs: readNumber("CIRCUIT_OPEN_MS", process.env.CIRCUIT_OPEN_MS, 30_000, { min: 1_000 }),
    };
}
