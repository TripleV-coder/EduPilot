/**
 * Limites de débit — module unique (L3, décision du propriétaire du 2026-09-18).
 *
 * Moteur : fenêtre fixe (compteur + expiration). C'est le seul qui sache
 * **rendre** une unité consommée (`releaseRateLimit`), ce dont dépend le
 * correctif H4 — seuls les échecs de connexion comptent.
 *
 * Stockage (2026-11-07, Redis retiré) :
 *  - PostgreSQL (`lib/shared-state/pg`, table UNLOGGED) : compteur partagé
 *    par toutes les instances et tous les processus, une instruction atomique
 *    par appel, horloge du serveur de base ;
 *  - un refus est retenu localement jusqu'à la fin de sa fenêtre : une rafale
 *    contre une clé bloquée (force brute) est refusée SANS toucher la base ;
 *  - base lente ou injoignable → coupe-circuit, repli mémoire immédiat : la
 *    plateforme n'est jamais sans limite ni bloquée en attente.
 */

import type { NextRequest } from "next/server";
import { getClientIp as getTrustedClientIp } from "@/lib/security/client-ip";
import { counterDelete, counterRelease, sharedStoreEnabled, storeCircuit, windowAdd } from "@/lib/shared-state/pg";

// ─── Types publics ────────────────────────────────────────────────────────────

export interface RateLimitConfig {
    /** Nombre d'unités autorisées par fenêtre. */
    maxAttempts: number;
    /** Durée de la fenêtre, en millisecondes. */
    windowMs: number;
}

/** Limiteur nommé : le nom donne son propre seau à chaque famille d'appels. */
export interface LimiterHandle {
    name: string;
    config: RateLimitConfig;
}

export interface RateLimitResult {
    success: boolean;
    remaining: number;
    reset: Date;
}

// ─── Magasin mémoire ──────────────────────────────────────────────────────────

interface MemoryEntry {
    count: number;
    resetTime: number;
}

class InMemoryStore {
    private store = new Map<string, MemoryEntry>();

    constructor() {
        const interval = setInterval(() => {
            const now = Date.now();
            for (const [key, entry] of this.store.entries()) {
                if (entry.resetTime < now) this.store.delete(key);
            }
            for (const [key, until] of blockedUntil) {
                if (until < now) blockedUntil.delete(key);
            }
        }, 5 * 60 * 1000);
        if (interval.unref) interval.unref();
    }

    get(key: string): MemoryEntry | undefined {
        const entry = this.store.get(key);
        if (entry && entry.resetTime < Date.now()) {
            this.store.delete(key);
            return undefined;
        }
        return entry;
    }

    set(key: string, value: MemoryEntry): void {
        this.store.set(key, value);
    }

    delete(key: string): void {
        this.store.delete(key);
    }
}

/** Clés refusées par le magasin partagé, jusqu'à la fin de leur fenêtre (ms). */
const blockedUntil = new Map<string, number>();

const memoryStore = new InMemoryStore();

// ─── Moteur ───────────────────────────────────────────────────────────────────

/** Magasin partagé : une instruction atomique ; le refus est retenu localement. */
async function consumeShared(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const { count, ttlMs } = await windowAdd(key, config.windowMs);
    const reset = new Date(Date.now() + (ttlMs > 0 ? ttlMs : config.windowMs));
    const success = count <= config.maxAttempts;
    if (!success) blockedUntil.set(key, reset.getTime());
    return { success, remaining: Math.max(0, config.maxAttempts - count), reset };
}

function consumeMemory(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const entry = memoryStore.get(key);

    if (!entry) {
        const resetTime = now + config.windowMs;
        memoryStore.set(key, { count: 1, resetTime });
        return {
            success: true,
            remaining: config.maxAttempts - 1,
            reset: new Date(resetTime),
        };
    }

    if (entry.count >= config.maxAttempts) {
        return { success: false, remaining: 0, reset: new Date(entry.resetTime) };
    }

    entry.count += 1;
    memoryStore.set(key, entry);
    return {
        success: true,
        remaining: config.maxAttempts - entry.count,
        reset: new Date(entry.resetTime),
    };
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Consomme une unité sur une clé construite par l'appelant.
 * Réservé aux compteurs dont la clé porte déjà son propre préfixe
 * (`createRateLimitKey`), par exemple les échecs de connexion.
 */
export async function checkRateLimitKey(
    key: string,
    config: RateLimitConfig
): Promise<RateLimitResult> {
    if (!sharedStoreEnabled()) return consumeMemory(key, config);
    const blocked = blockedUntil.get(key);
    if (blocked !== undefined && blocked > Date.now()) {
        return { success: false, remaining: 0, reset: new Date(blocked) };
    }
    return storeCircuit.run(
        () => consumeShared(key, config),
        () => consumeMemory(key, config)
    );
}

/**
 * Consomme une unité sur un limiteur nommé.
 *
 * Le nom entre dans la clé : chaque limiteur garde son propre seau. Sans cela,
 * toutes les familles d'appels partageraient un compteur, et la limite la plus
 * stricte bloquerait l'application entière en quelques requêtes.
 */
export async function checkRateLimit(
    handle: LimiterHandle,
    identifier: string
): Promise<RateLimitResult> {
    return checkRateLimitKey(createRateLimitKey(handle.name, identifier), handle.config);
}

/** Remet un compteur à zéro (ex. second facteur validé). */
export async function resetRateLimit(key: string): Promise<void> {
    memoryStore.delete(key);
    blockedUntil.delete(key);
    if (!sharedStoreEnabled()) return;
    await storeCircuit.run(() => counterDelete(key), () => undefined);
}

/**
 * Rend une unité consommée (ex. connexion réussie : seuls les échecs doivent
 * compter). Compter AVANT puis rendre en cas de succès évite qu'une rafale
 * parallèle dépasse la limite.
 */
export async function releaseRateLimit(key: string): Promise<void> {
    blockedUntil.delete(key);
    if (sharedStoreEnabled()) {
        const released = await storeCircuit.run(
            async () => {
                await counterRelease(key);
                return true;
            },
            () => false
        );
        if (released) return;
    }
    const entry = memoryStore.get(key);
    if (!entry) return;
    entry.count -= 1;
    if (entry.count <= 0) memoryStore.delete(key);
    else memoryStore.set(key, entry);
}

/** Rend l'unité consommée par `checkRateLimit` pour ce limiteur nommé. */
export async function releaseLimiter(
    handle: LimiterHandle,
    identifier: string
): Promise<void> {
    await releaseRateLimit(createRateLimitKey(handle.name, identifier));
}

export function createRateLimitKey(prefix: string, identifier: string): string {
    return `rl:${prefix}:${identifier}`;
}

/** IP client de confiance (source unique : `@/lib/security/client-ip`, audit H3). */
export function getClientIp(request: Request): string {
    return getTrustedClientIp(request.headers);
}

/** Identifiant de client pour le middleware — jamais un en-tête fourni par le client (H3). */
export function getClientIdentifier(request: NextRequest | Request): string {
    return getTrustedClientIp(request.headers);
}

// ─── Limiteurs nommés ─────────────────────────────────────────────────────────

// Assouplir les limites en développement pour éviter les ralentissements.
// RATE_LIMIT_RELAXED=true : réservé au CI e2e, où `next start` force
// NODE_ENV=production alors que toute la suite Playwright partage une seule
// IP — les limites prod (ex. strict 20/min) la bloqueraient en quelques
// secondes. Ne jamais définir cette variable en production réelle.
const isDev =
    process.env.NODE_ENV === "development" ||
    process.env.RATE_LIMIT_RELAXED === "true";

/** API générale : 100 req / minute par IP (500 en dev). */
export const apiLimiter: LimiterHandle = {
    name: "api",
    config: { maxAttempts: isDev ? 500 : 100, windowMs: 60 * 1000 },
};

/** Auth (login, mot de passe oublié) : 5 essais / 15 minutes (20 en dev). */
export const authLimiter: LimiterHandle = {
    name: "auth",
    config: { maxAttempts: isDev ? 20 : 5, windowMs: 15 * 60 * 1000 },
};

/** Opérations sensibles (paiements, notes, comptes) : 20 req / minute (100 en dev). */
export const strictLimiter: LimiterHandle = {
    name: "strict",
    config: { maxAttempts: isDev ? 100 : 20, windowMs: 60 * 1000 },
};

/** Envoi de fichiers : 10 / minute (50 en dev). */
export const uploadLimiter: LimiterHandle = {
    name: "upload",
    config: { maxAttempts: isDev ? 50 : 10, windowMs: 60 * 1000 },
};

// ─── Configurations nommées (clé construite par l'appelant) ───────────────────

/**
 * Échecs de connexion par COMPTE depuis une adresse (audit H4). Seuls les
 * échecs comptent. Une devinette de mot de passe vise un compte : c'est lui
 * que l'on protège ; depuis plusieurs adresses, le verrouillage du compte
 * (`auth/account-lockout`) prend le relais.
 */
export const LOGIN_FAILURE_RATE_LIMIT: RateLimitConfig = {
    maxAttempts: 10,
    windowMs: 15 * 60 * 1000,
};

/**
 * Échecs de connexion par ADRESSE, tous comptes confondus (essais en masse
 * sur une liste de comptes). Large : une école entière sort souvent par un
 * seul routeur 4G, les familles par le NAT de l'opérateur. L'ancienne limite
 * (10 par IP, tentatives en cours comprises) refusait 20 élèves sur 30 qui se
 * connectaient ensemble et bloquait toute l'école 15 min après 10 fautes de
 * frappe (analyse de capacité 2026-10-01, G3).
 */
export function loginIpFailureRateLimit(): RateLimitConfig {
    const configured = Number(process.env.LOGIN_IP_FAILURES_PER_15MIN);
    return {
        maxAttempts: Number.isFinite(configured) && configured >= 1 ? configured : 200,
        windowMs: 15 * 60 * 1000,
    };
}

export type LoginAttempt =
    | { allowed: true; release: () => Promise<void> }
    | { allowed: false; reset: Date };

/**
 * Réserve une tentative de connexion (ou d'activation) : une unité sur le
 * compteur du compte depuis cette adresse, une sur celui de l'adresse. La
 * tentative est comptée AVANT la vérification (une rafale parallèle ne
 * dépasse pas les limites) ; l'appelant appelle `release()` si elle n'était
 * pas un échec d'identifiants.
 */
export async function reserveLoginAttempt(
    scope: string,
    ip: string,
    account: string | null | undefined,
): Promise<LoginAttempt> {
    const normalizedAccount = account?.trim().toLowerCase();
    const accountKey = normalizedAccount
        ? createRateLimitKey(`${scope}:account`, `${ip}:${normalizedAccount}`)
        : null;
    const ipKey = createRateLimitKey(`${scope}:ip`, ip);

    if (accountKey) {
        const perAccount = await checkRateLimitKey(accountKey, LOGIN_FAILURE_RATE_LIMIT);
        if (!perAccount.success) return { allowed: false, reset: perAccount.reset };
    }
    const perIp = await checkRateLimitKey(ipKey, loginIpFailureRateLimit());
    if (!perIp.success) {
        if (accountKey) await releaseRateLimit(accountKey);
        return { allowed: false, reset: perIp.reset };
    }

    return {
        allowed: true,
        release: async () => {
            await releaseRateLimit(ipKey);
            if (accountKey) await releaseRateLimit(accountKey);
        },
    };
}

export const LOGIN_RATE_LIMIT: RateLimitConfig = {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
};

export const FORGOT_PASSWORD_RATE_LIMIT: RateLimitConfig = {
    maxAttempts: 3,
    windowMs: 15 * 60 * 1000,
};

/**
 * Vérification du second facteur. Un TOTP ne fait que 6 chiffres (10^6
 * combinaisons) et reste valide ~30 s : sans plafond, un code est devinable par
 * force brute. Plus strict que le login, car la victime a déjà franchi l'étape
 * du mot de passe.
 */
export const MFA_VERIFY_RATE_LIMIT: RateLimitConfig = {
    maxAttempts: 5,
    windowMs: 10 * 60 * 1000,
};

export const API_RATE_LIMIT: RateLimitConfig = {
    maxAttempts: 100,
    windowMs: 60 * 1000,
};

// ─── Mappage route → limiteur ─────────────────────────────────────────────────

/** Limiteur applicable à un chemin d'API, ou `null` hors API. */
export function getLimiterForRoute(pathname: string): LimiterHandle | null {
    if (
        pathname.includes("/api/auth/login") ||
        pathname.includes("/api/auth/forgot-password")
    ) {
        return authLimiter;
    }

    const sensitiveRoutes = [
        "/api/payments",
        "/api/grades",
        "/api/users",
        "/api/schools",
        "/api/upload",
    ];
    if (sensitiveRoutes.some((route) => pathname.startsWith(route))) {
        return strictLimiter;
    }

    if (pathname.startsWith("/api/")) return apiLimiter;

    return null;
}
