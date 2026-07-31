/**
 * Miroir Edge-compatible du mode maintenance.
 *
 * La source de vérité reste `SystemSetting` en base (cf. `./maintenance`), mais
 * elle est inatteignable depuis le middleware : Prisma ne tourne pas sur le
 * runtime Edge, et y basculer le middleware en runtime Node ajouterait une
 * requête SQL au chemin chaud de **chaque** requête, y compris les assets.
 *
 * On publie donc l'état dans Redis (Upstash REST, joignable depuis l'Edge) à
 * chaque écriture, et le middleware ne lit que ce miroir. C'est ce qui permet
 * d'imposer la maintenance aux 208 routes qui n'utilisent pas
 * `createApiHandler`, sans les réécrire une à une.
 *
 * **Fail-open assumé** : sans Redis configuré, ou en cas d'erreur réseau, le
 * middleware laisse passer. Le mode maintenance est une mesure d'exploitation,
 * pas de sécurité — un incident Redis ne doit jamais verrouiller la plateforme.
 * `createApiHandler` et le layout du dashboard restent des filets de sécurité
 * qui, eux, lisent la base directement.
 */
import { Redis } from "@upstash/redis";

/** Clé du miroir Redis. */
export const MAINTENANCE_EDGE_KEY = "edupilot:maintenance";

/** Durée de vie du cache mémoire, alignée sur celle du cache Prisma. */
const TTL_MS = 15_000;

export interface EdgeMaintenanceState {
    enabled: boolean;
    message: string;
}

let client: Redis | null = null;
let clientResolved = false;

function getRedis(): Redis | null {
    if (clientResolved) return client;
    clientResolved = true;

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
        client = null;
        return null;
    }

    client = new Redis({ url, token });
    return client;
}

let cache: { state: EdgeMaintenanceState | null; at: number } | null = null;

/** Vide le cache mémoire (tests, ou après publication). */
export function resetEdgeMaintenanceCache(): void {
    cache = null;
    clientResolved = false;
    client = null;
}

/**
 * Publie l'état courant dans le miroir Redis. Appelé après chaque écriture de
 * l'état en base. Silencieux en cas d'échec : la base reste la source de vérité.
 */
export async function publishMaintenanceState(state: EdgeMaintenanceState): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    try {
        await redis.set(MAINTENANCE_EDGE_KEY, JSON.stringify(state));
        cache = { state, at: Date.now() };
    } catch {
        // Le miroir est un optimisant, jamais un point de défaillance.
    }
}

/**
 * Lit l'état depuis le miroir. Retourne `null` quand l'état est inconnu
 * (Redis absent, jamais publié, ou erreur) — l'appelant doit alors laisser
 * passer.
 */
export async function readEdgeMaintenanceState(): Promise<EdgeMaintenanceState | null> {
    if (cache && Date.now() - cache.at < TTL_MS) return cache.state;

    const redis = getRedis();
    if (!redis) return null;

    try {
        const raw = await redis.get<string | EdgeMaintenanceState>(MAINTENANCE_EDGE_KEY);
        let state: EdgeMaintenanceState | null = null;

        if (raw && typeof raw === "object" && "enabled" in raw) {
            // Upstash désérialise parfois le JSON tout seul.
            state = { enabled: !!raw.enabled, message: String(raw.message ?? "") };
        } else if (typeof raw === "string" && raw.length > 0) {
            const parsed = JSON.parse(raw) as EdgeMaintenanceState;
            state = { enabled: !!parsed.enabled, message: String(parsed.message ?? "") };
        }

        cache = { state, at: Date.now() };
        return state;
    } catch {
        return null;
    }
}

/**
 * SUPER_ADMIN traverse toujours la maintenance : c'est le seul rôle capable
 * d'en sortir. Dupliqué depuis `./maintenance` pour garder ce module sans
 * aucune dépendance Node.
 */
export function edgeMaintenanceBlocksRole(role: string | undefined | null): boolean {
    return role !== "SUPER_ADMIN";
}
