import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Lot 7 — ce qui se passe au démarrage du serveur décide de la sûreté de tout
 * le reste : validation de l'environnement, garde RLS, et surtout les
 * fermetures à exécuter à l'arrêt. Aucune dépendance facultative ne doit
 * pouvoir empêcher tout cela.
 *
 * Sentry retiré (2026-11-08) : les erreurs non interceptées vont au journal
 * des erreurs interne (onRequestError → recordError).
 */
const mocks = vi.hoisted(() => ({
  validateEnv: vi.fn(),
  registerShutdownTask: vi.fn(),
  warmCache: vi.fn().mockResolvedValue(undefined),
  recordError: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  closeCache: vi.fn().mockResolvedValue(undefined),
  assertRls: vi.fn().mockResolvedValue(undefined),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("../../src/lib/env", () => ({ validateEnv: mocks.validateEnv }));
vi.mock("../../src/lib/system/shutdown", () => ({ registerShutdownTask: mocks.registerShutdownTask }));
vi.mock("../../src/lib/cache/warm", () => ({ warmCache: mocks.warmCache }));
vi.mock("../../src/lib/monitoring/error-journal", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/lib/monitoring/error-journal")>()),
  recordError: mocks.recordError,
}));
vi.mock("../../src/lib/prisma", () => ({ prisma: { $disconnect: mocks.disconnect }, default: { $disconnect: mocks.disconnect } }));
vi.mock("../../src/lib/cache/service", () => ({ closeCache: mocks.closeCache }));
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
  it("enregistre les fermetures de la file, de Prisma et du cache", async () => {
    const { register } = await import("../../instrumentation");

    await register();

    expect(mocks.validateEnv).toHaveBeenCalled();
    expect(mocks.registerShutdownTask).toHaveBeenCalledTimes(2);
  });

  it("erreur non interceptée : inscrite au journal des erreurs avec son chemin", async () => {
    const { onRequestError } = await import("../../instrumentation");
    await onRequestError(new TypeError("x is undefined"), { path: "/dashboard/grades?eleve=42" });
    expect(mocks.recordError).toHaveBeenCalledWith(
      expect.objectContaining({ source: "server", message: "TypeError: x is undefined", path: "/dashboard/grades?eleve=42" }),
    );
  });

  it("journal indisponible : onRequestError ne lève jamais", async () => {
    mocks.recordError.mockRejectedValueOnce(new Error("base injoignable"));
    const { onRequestError } = await import("../../instrumentation");
    await expect(onRequestError(new Error("boom"), {})).resolves.toBeUndefined();
  });

  it("ferme réellement Prisma et le cache quand les tâches sont exécutées", async () => {
    const { register } = await import("../../instrumentation");
    await register();

    for (const [task] of mocks.registerShutdownTask.mock.calls) {
      await (task as () => Promise<void>)();
    }

    expect(mocks.disconnect).toHaveBeenCalled();
    expect(mocks.closeCache).toHaveBeenCalled();
  });

  it("ne fait rien hors du runtime Node", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    const { register } = await import("../../instrumentation");

    await register();

    expect(mocks.registerShutdownTask).not.toHaveBeenCalled();
  });
});
