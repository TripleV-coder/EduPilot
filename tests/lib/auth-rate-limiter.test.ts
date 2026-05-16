import { describe, it, expect } from "vitest";
import {
  LOGIN_RATE_LIMIT,
  FORGOT_PASSWORD_RATE_LIMIT,
  API_RATE_LIMIT,
  getClientIp,
  createRateLimitKey,
  checkRateLimit,
  resetRateLimit,
} from "@/lib/auth/rate-limiter";

describe("auth/rate-limiter", () => {
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

  describe("getClientIp", () => {
    function mockReq(headers: Record<string, string>): Request {
      const h = new Headers(headers);
      return { headers: h } as any;
    }

    it("reads X-Forwarded-For first IP", () => {
      const req = mockReq({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
      expect(getClientIp(req)).toBe("1.2.3.4");
    });

    it("falls back to X-Real-IP", () => {
      const req = mockReq({ "x-real-ip": "9.9.9.9" });
      expect(getClientIp(req)).toBe("9.9.9.9");
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

  describe("in-memory checkRateLimit / resetRateLimit", () => {
    it("allows up to maxAttempts then blocks", async () => {
      const config = { maxAttempts: 3, windowMs: 60_000 };
      const key = "rl:test:" + Math.random();

      for (let i = 1; i <= 3; i++) {
        const r = await checkRateLimit(key, config);
        expect(r.allowed).toBe(true);
        expect(r.remaining).toBe(3 - i);
      }
      const blocked = await checkRateLimit(key, config);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it("reset clears the counter", async () => {
      const config = { maxAttempts: 1, windowMs: 60_000 };
      const key = "rl:test-reset:" + Math.random();
      await checkRateLimit(key, config);
      const blocked = await checkRateLimit(key, config);
      expect(blocked.allowed).toBe(false);

      await resetRateLimit(key);
      const after = await checkRateLimit(key, config);
      expect(after.allowed).toBe(true);
    });
  });
});
