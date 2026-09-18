import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  LOGIN_RATE_LIMIT,
  FORGOT_PASSWORD_RATE_LIMIT,
  API_RATE_LIMIT,
  getClientIp,
  createRateLimitKey,
  checkRateLimitKey,
  resetRateLimit,
} from "@/lib/rate-limit";

// L3 — `lib/auth/rate-limiter.ts` a fusionné dans `lib/rate-limit.ts` :
// même moteur, même magasin. Les cas ci-dessous sont inchangés, seuls le
// chemin du module et le nom de l'entrée (`checkRateLimitKey`) ont suivi.
describe("rate-limit — clés construites par l'appelant", () => {
  describe("predefined configs", () => {
    it("LOGIN allows 5 attempts in 15 min", () => {
      expect(LOGIN_RATE_LIMIT.maxAttempts).toBe(5);
      expect(LOGIN_RATE_LIMIT.windowMs).toBe(15 * 60 * 1000);
    });

    it("FORGOT_PASSWORD allows 3 attempts in 15 min", () => {
      expect(FORGOT_PASSWORD_RATE_LIMIT.maxAttempts).toBe(3);
    });

    it("API_RATE_LIMIT is 100/minute", () => {
      expect(API_RATE_LIMIT.maxAttempts).toBe(100);
      expect(API_RATE_LIMIT.windowMs).toBe(60_000);
    });
  });

  // Audit H3 : ces tests exigeaient auparavant le premier élément de
  // X-Forwarded-For puis X-Real-IP — deux en-têtes choisis par le client, ce
  // qui permettait de contourner tout rate-limit (130 requêtes à XFF tournant
  // → 0×429). getClientIp délègue désormais à `@/lib/security/client-ip`.
  describe("getClientIp", () => {
    const TOKEN = "d".repeat(64);

    beforeEach(() => {
      vi.stubEnv("EDUPILOT_PEER_TOKEN", TOKEN);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    function mockReq(headers: Record<string, string>): Request {
      const h = new Headers(headers);
      return { headers: h } as unknown as Request;
    }

    it("ignores client-supplied X-Forwarded-For and X-Real-IP", () => {
      expect(getClientIp(mockReq({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("unknown");
      expect(getClientIp(mockReq({ "x-real-ip": "9.9.9.9" }))).toBe("unknown");
    });

    it("reads the socket address appended by the server preload", () => {
      const req = mockReq({ "x-forwarded-for": "1.2.3.4, 5.6.7.8", "x-edupilot-peer-token": TOKEN });
      expect(getClientIp(req)).toBe("5.6.7.8");
    });

    it("returns 'unknown' when nothing", () => {
      expect(getClientIp(mockReq({}))).toBe("unknown");
    });
  });

  describe("createRateLimitKey", () => {
    it("prefixes with rl:", () => {
      expect(createRateLimitKey("login", "user@x.com")).toBe("rl:login:user@x.com");
    });
  });

  describe("in-memory checkRateLimitKey / resetRateLimit", () => {
    it("allows up to maxAttempts then blocks", async () => {
      const config = { maxAttempts: 3, windowMs: 60_000 };
      const key = "rl:test:" + Math.random();

      for (let i = 1; i <= 3; i++) {
        const r = await checkRateLimitKey(key, config);
        expect(r.success).toBe(true);
        expect(r.remaining).toBe(3 - i);
      }
      const blocked = await checkRateLimitKey(key, config);
      expect(blocked.success).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it("reset clears the counter", async () => {
      const config = { maxAttempts: 1, windowMs: 60_000 };
      const key = "rl:test-reset:" + Math.random();
      await checkRateLimitKey(key, config);
      const blocked = await checkRateLimitKey(key, config);
      expect(blocked.success).toBe(false);

      await resetRateLimit(key);
      const after = await checkRateLimitKey(key, config);
      expect(after.success).toBe(true);
    });
  });
});
