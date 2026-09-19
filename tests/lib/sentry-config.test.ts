import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Lot 7 — la surveillance des erreurs doit être **prête mais inactive** tant
 * qu'aucun DSN n'est fourni : l'installation d'une école qui n'a pas de compte
 * Sentry ne doit ni tenter d'émettre, ni échouer au démarrage. Et lorsqu'elle
 * est active, elle ne doit pas exporter de données personnelles.
 */
const { init, setUser } = vi.hoisted(() => ({ init: vi.fn(), setUser: vi.fn() }));

vi.mock("@sentry/nextjs", () => ({ init, setUser, captureException: vi.fn(), captureMessage: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  init.mockClear();
  setUser.mockClear();
  delete process.env.SENTRY_DSN;
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Sentry", () => {
  it("reste inactif sans DSN, et le dit une fois", async () => {
    const { initSentryServer } = await import("@/lib/monitoring/sentry");
    const { logger } = await import("@/lib/utils/logger");
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

    initSentryServer();

    expect(init).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("reste inactif sans DSN côté Edge, sans bruit", async () => {
    const { initSentryEdge } = await import("@/lib/monitoring/sentry");
    initSentryEdge();
    expect(init).not.toHaveBeenCalled();
  });

  it("s'initialise dès qu'un DSN est fourni", async () => {
    process.env.SENTRY_DSN = "https://exemple@o0.ingest.sentry.io/1";
    const { initSentryServer } = await import("@/lib/monitoring/sentry");

    initSentryServer();

    expect(init).toHaveBeenCalledTimes(1);
    expect(init.mock.calls[0][0].dsn).toBe("https://exemple@o0.ingest.sentry.io/1");
  });

  it("retire les en-têtes d'authentification et les jetons avant l'envoi", async () => {
    process.env.SENTRY_DSN = "https://exemple@o0.ingest.sentry.io/1";
    const { initSentryServer } = await import("@/lib/monitoring/sentry");
    initSentryServer();
    const beforeSend = init.mock.calls[0][0].beforeSend as (e: unknown) => unknown;

    const event = beforeSend({
      request: {
        headers: { authorization: "Bearer secret", cookie: "session=abc", "user-agent": "test" },
        query_string: "token=abc&password=def&page=2",
      },
    }) as { request: { headers: Record<string, string>; query_string: string } };

    expect(event.request.headers.authorization).toBeUndefined();
    expect(event.request.headers.cookie).toBeUndefined();
    expect(event.request.headers["user-agent"]).toBe("test");
    expect(event.request.query_string).not.toContain("abc");
    expect(event.request.query_string).toContain("page=2");
  });

  it("n'exporte pas l'adresse électronique d'une personne", async () => {
    const { setUserContext } = await import("@/lib/monitoring/sentry");

    setUserContext("user-123", "parent@exemple.fr", "PARENT");

    expect(JSON.stringify(setUser.mock.calls[0][0])).not.toContain("parent@exemple.fr");
    expect(setUser.mock.calls[0][0]).toMatchObject({ id: "user-123", role: "PARENT" });
  });
});
