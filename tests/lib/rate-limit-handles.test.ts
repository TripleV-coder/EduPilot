import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  checkRateLimit,
  apiLimiter,
  authLimiter,
  strictLimiter,
  uploadLimiter,
} from "@/lib/rate-limit";

/**
 * Sans UPSTASH_REDIS_REST_URL/TOKEN (cas de la suite de tests), tous les
 * LimiterHandle ont limiter=null → le fallback in-memory est exercé.
 * Régression du bug CI 2026-06-10 : chaque limiter doit garder son propre
 * bucket (la résolution par identité faisait tout matcher sur auth 5/15min).
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit — fallback in-memory", () => {
  it("expose un handle nommé avec fallback pour chaque limiter", () => {
    expect(apiLimiter.name).toBe("api");
    expect(authLimiter.name).toBe("auth");
    expect(strictLimiter.name).toBe("strict");
    expect(uploadLimiter.name).toBe("upload");
    for (const handle of [apiLimiter, authLimiter, strictLimiter, uploadLimiter]) {
      expect(handle.limiter).toBeNull(); // pas d'Upstash en test
      expect(handle.fallback.limit).toBeGreaterThan(0);
    }
  });

  it("bloque après la limite et décompte remaining", async () => {
    const ip = "10.99.0.1";
    const limit = authLimiter.fallback.limit;

    for (let i = 1; i <= limit; i++) {
      const result = await checkRateLimit(authLimiter, ip);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(limit - i);
    }

    const blocked = await checkRateLimit(authLimiter, ip);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.reset.getTime()).toBeGreaterThan(Date.now());
  });

  it("régression : les buckets sont isolés par limiter (auth saturé ≠ api bloqué)", async () => {
    const ip = "10.99.0.2";

    // Saturer le limiter auth
    for (let i = 0; i <= authLimiter.fallback.limit; i++) {
      await checkRateLimit(authLimiter, ip);
    }
    expect((await checkRateLimit(authLimiter, ip)).success).toBe(false);

    // La même IP doit rester servie sur les autres limiters
    expect((await checkRateLimit(apiLimiter, ip)).success).toBe(true);
    expect((await checkRateLimit(strictLimiter, ip)).success).toBe(true);
    expect((await checkRateLimit(uploadLimiter, ip)).success).toBe(true);
  });

  it("isole les buckets par identifiant (IP)", async () => {
    const limit = uploadLimiter.fallback.limit;
    for (let i = 0; i <= limit; i++) {
      await checkRateLimit(uploadLimiter, "10.99.0.3");
    }
    expect((await checkRateLimit(uploadLimiter, "10.99.0.3")).success).toBe(false);
    expect((await checkRateLimit(uploadLimiter, "10.99.0.4")).success).toBe(true);
  });

  it("réinitialise le compteur après la fenêtre", async () => {
    const ip = "10.99.0.5";
    const { limit, windowMs } = strictLimiter.fallback;

    for (let i = 0; i <= limit; i++) {
      await checkRateLimit(strictLimiter, ip);
    }
    expect((await checkRateLimit(strictLimiter, ip)).success).toBe(false);

    vi.advanceTimersByTime(windowMs + 1000);

    const afterReset = await checkRateLimit(strictLimiter, ip);
    expect(afterReset.success).toBe(true);
    expect(afterReset.remaining).toBe(limit - 1);
  });
});
