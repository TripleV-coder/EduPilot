import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Lot 7 — ce qui se passe au démarrage du serveur décide de la sûreté de tout
 * le reste : validation de l'environnement, garde RLS, et surtout les
 * fermetures à exécuter à l'arrêt. Aucune dépendance facultative ne doit
 * pouvoir empêcher tout cela.
 *
 * Constaté à l'exécution : dans la sortie standalone (l'image de production),
 * l'initialisation de Sentry échouait sur un module absent, et l'erreur
 * emportait TOUT le hook — plus aucune fermeture n'était enregistrée.
 */
const mocks = vi.hoisted(() => ({
  validateEnv: vi.fn(),
  registerShutdownTask: vi.fn(),
  warmCache: vi.fn().mockResolvedValue(undefined),
  initSentryServer: vi.fn(),
  disconnect: vi.fn().mockResolvedValue(undefined),
  closeRedis: vi.fn().mockResolvedValue(undefined),
  assertRls: vi.fn().mockResolvedValue(undefined),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("../../src/lib/env", () => ({ validateEnv: mocks.validateEnv }));
vi.mock("../../src/lib/system/shutdown", () => ({ registerShutdownTask: mocks.registerShutdownTask }));
vi.mock("../../src/lib/cache/warm", () => ({ warmCache: mocks.warmCache }));
vi.mock("../../src/lib/monitoring/sentry", () => ({ initSentryServer: mocks.initSentryServer, initSentryEdge: vi.fn() }));
vi.mock("../../src/lib/prisma", () => ({ prisma: { $disconnect: mocks.disconnect }, default: { $disconnect: mocks.disconnect } }));
vi.mock("../../src/lib/cache/redis", () => ({ closeRedis: mocks.closeRedis }));
vi.mock("../../src/lib/db/rls-guard", () => ({ assertRlsEnforcedAtStartup: mocks.assertRls }));
vi.mock("../../src/lib/utils/logger", () => ({
  logger: { warn: mocks.warn, info: mocks.info, error: vi.fn(), debug: vi.fn() },
  setRequestIdProvider: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("démarrage du serveur", () => {
  it("enregistre les fermetures de Prisma et de Redis", async () => {
    const { register } = await import("../../instrumentation");

    await register();

    expect(mocks.validateEnv).toHaveBeenCalled();
    expect(mocks.registerShutdownTask).toHaveBeenCalledTimes(2);
  });

  it("n'essaie même pas de charger Sentry sans DSN", async () => {
    const { register } = await import("../../instrumentation");

    await register();

    expect(mocks.initSentryServer).not.toHaveBeenCalled();
  });

  it("enregistre les fermetures même si Sentry ne peut pas se charger", async () => {
    vi.stubEnv("SENTRY_DSN", "https://exemple@o0.ingest.sentry.io/1");
    mocks.initSentryServer.mockImplementationOnce(() => {
      throw new Error("Cannot find module 'require-in-the-middle'");
    });

    const { register } = await import("../../instrumentation");
    await register();

    expect(mocks.registerShutdownTask).toHaveBeenCalledTimes(2);
    expect(mocks.warn).toHaveBeenCalled();
  });

  it("ferme réellement Prisma et Redis quand les tâches sont exécutées", async () => {
    const { register } = await import("../../instrumentation");
    await register();

    for (const [task] of mocks.registerShutdownTask.mock.calls) {
      await (task as () => Promise<void>)();
    }

    expect(mocks.disconnect).toHaveBeenCalled();
    expect(mocks.closeRedis).toHaveBeenCalled();
  });

  it("ne fait rien hors du runtime Node", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    const { register } = await import("../../instrumentation");

    await register();

    expect(mocks.registerShutdownTask).not.toHaveBeenCalled();
  });
});
