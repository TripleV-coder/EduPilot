import { describe, it, expect } from "vitest";
import {
    apiLimiter,
    authLimiter,
    checkRateLimit,
    checkRateLimitKey,
    createRateLimitKey,
    getLimiterForRoute,
    releaseLimiter,
    releaseRateLimit,
    strictLimiter,
} from "@/lib/rate-limit";

/**
 * L3 — fusion des trois modules de limitation (décision du propriétaire du
 * 2026-09-18). Avant, deux moteurs cohabitaient : les limiteurs nommés
 * tournaient sur @upstash/ratelimit, les compteurs d'authentification sur un
 * moteur maison, chacun avec son propre magasin mémoire. Une même adresse
 * consommait donc deux quotas distincts selon la porte d'entrée, et aucun
 * limiteur nommé ne savait rendre une unité — ce dont dépend H4.
 *
 * Ces cas ne compilaient même pas sur le code d'avant : ni `checkRateLimitKey`
 * ni `releaseLimiter` n'existaient.
 */
describe("rate-limit — un seul moteur pour les deux conventions", () => {
    it("un limiteur nommé et sa clé explicite partagent le même compteur", async () => {
        const ip = "203.0.113.10";
        const key = createRateLimitKey(strictLimiter.name, ip);

        const first = await checkRateLimit(strictLimiter, ip);
        const second = await checkRateLimitKey(key, strictLimiter.config);

        // Deuxième consommation du MÊME seau : le reste décroît de 1 encore.
        expect(second.remaining).toBe(first.remaining - 1);
    });

    it("rend une unité consommée sur un limiteur nommé (H4 : seuls les échecs comptent)", async () => {
        const ip = "203.0.113.11";
        const limit = authLimiter.config.maxAttempts;

        // Saturer, puis vérifier le blocage.
        for (let i = 0; i < limit; i++) await checkRateLimit(authLimiter, ip);
        expect((await checkRateLimit(authLimiter, ip)).success).toBe(false);

        // Rendre deux unités : la porte se rouvre.
        await releaseLimiter(authLimiter, ip);
        await releaseLimiter(authLimiter, ip);
        expect((await checkRateLimit(authLimiter, ip)).success).toBe(true);
    });

    it("rendre plus que consommé ne crée pas de crédit négatif", async () => {
        const ip = "203.0.113.12";
        const key = createRateLimitKey("test-release", ip);
        const config = { maxAttempts: 2, windowMs: 60_000 };

        await checkRateLimitKey(key, config);
        for (let i = 0; i < 5; i++) await releaseRateLimit(key);

        // Le compteur est remis à zéro, pas en dessous : 2 consommations
        // restent possibles, la 3e est refusée.
        expect((await checkRateLimitKey(key, config)).success).toBe(true);
        expect((await checkRateLimitKey(key, config)).success).toBe(true);
        expect((await checkRateLimitKey(key, config)).success).toBe(false);
    });

    it("le mappage route → limiteur vit dans le même module", () => {
        expect(getLimiterForRoute("/api/auth/forgot-password")).toBe(authLimiter);
        expect(getLimiterForRoute("/api/payments/x")).toBe(strictLimiter);
        expect(getLimiterForRoute("/api/classes")).toBe(apiLimiter);
        expect(getLimiterForRoute("/dashboard")).toBeNull();
    });
});
