import { beforeEach, describe, expect, it, vi } from "vitest";

describe("reportWebVitals", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "false";
  });

  it("ne fait rien côté serveur", async () => {
    const { reportWebVitals } = await import("@/lib/performance/web-vitals");

    expect(() => reportWebVitals()).not.toThrow();
  });

  it("branche les callbacks web-vitals et loggue en développement", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const onCLS = vi.fn((cb) => cb({ id: "1", name: "CLS", value: 0.02, rating: "good" }));
    const onFCP = vi.fn();
    const onLCP = vi.fn();
    const onTTFB = vi.fn();
    const onINP = vi.fn();

    vi.stubGlobal("window", { Sentry: undefined });
    vi.doMock("web-vitals", () => ({ onCLS, onFCP, onLCP, onTTFB, onINP }));

    const { reportWebVitals } = await import("@/lib/performance/web-vitals");
    reportWebVitals();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onCLS).toHaveBeenCalledOnce();
    expect(onFCP).toHaveBeenCalledOnce();
    expect(onLCP).toHaveBeenCalledOnce();
    expect(onTTFB).toHaveBeenCalledOnce();
    expect(onINP).toHaveBeenCalledOnce();
    expect(consoleSpy).toHaveBeenCalledWith(
      "[Web Vitals] CLS:",
      expect.objectContaining({ value: 0.02, rating: "good", id: "1" }),
    );
  });

  it("envoie aussi les métriques à Sentry et à l'endpoint analytics si activé", async () => {
    const distribution = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    const onCLS = vi.fn((cb) => cb({ id: "2", name: "CLS", value: 0.03, rating: "good" }));
    const onFCP = vi.fn();
    const onLCP = vi.fn();
    const onTTFB = vi.fn();
    const onINP = vi.fn();

    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "true";
    vi.stubGlobal("window", { Sentry: { metrics: { distribution } } });
    vi.stubGlobal("fetch", fetchMock);
    vi.doMock("web-vitals", () => ({ onCLS, onFCP, onLCP, onTTFB, onINP }));

    const { reportWebVitals } = await import("@/lib/performance/web-vitals");
    reportWebVitals();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(distribution).toHaveBeenCalledWith(
      "web_vitals",
      0.03,
      expect.objectContaining({
        tags: expect.objectContaining({
          metric_id: "2",
          metric_name: "CLS",
          metric_rating: "good",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analytics/web-vitals",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
      }),
    );
  });
});
