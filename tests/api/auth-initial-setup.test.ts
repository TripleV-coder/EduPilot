import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, cuid } from "./test-helpers";

const { checkRateLimitMock } = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { count: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
// Le routeur utilise le rate limiter in-memory/Redis : mock de checkRateLimit
// pour contrôler le comportement 429 sans état partagé entre tests.
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    checkRateLimitKey: checkRateLimitMock,
  };
});
// bcryptjs : hash réel coûteux (12 rounds) → mock au niveau module.
vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("hashed-password"),
  compare: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { GET, POST } from "@/app/api/auth/initial-setup/route";

const VALID_BODY = {
  firstName: "Jean",
  lastName: "Nouvel",
  email: "admin@edupilot.app",
  password: "AdminPassw0rd!",
  confirmPassword: "AdminPassw0rd!",
};

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockResolvedValue({ success: true, remaining: 3, reset: new Date(Date.now() + 60_000) });
  // Le mock global @prisma/client (tests/setup.ts) n'expose pas
  // TransactionIsolationLevel : la route y accède à l'appel de $transaction.
  (Prisma as { TransactionIsolationLevel?: Record<string, string> }).TransactionIsolationLevel = {
    Serializable: "Serializable",
  };
});

describe("GET /api/auth/initial-setup", () => {
  it("retourne setupNeeded=true quand aucun utilisateur n'existe", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.user.count).mockResolvedValue(0);

    const res = await GET(makeRequest("http://localhost:3000/api/auth/initial-setup"));
    expect(res.status).toBe(200);
    expect((await res.json()).setupNeeded).toBe(true);
  });

  it("retourne setupNeeded=false quand un utilisateur existe", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.user.count).mockResolvedValue(1);

    const res = await GET(makeRequest("http://localhost:3000/api/auth/initial-setup"));
    const body = await res.json();
    expect(body.setupNeeded).toBe(false);
  });

  it("retourne 500 si la vérification échoue", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.user.count).mockRejectedValue(new Error("db down"));

    const res = await GET(makeRequest("http://localhost:3000/api/auth/initial-setup"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("vérifier le statut");
  });
});

describe("POST /api/auth/initial-setup", () => {
  function post(body: Record<string, unknown>) {
    return POST(
      makeRequest("http://localhost:3000/api/auth/initial-setup", { method: "POST", body })
    );
  }

  it("retourne 429 quand le rate limit est atteint", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    // Le rate limiter de createApiHandler (clé rl:api:*) passe, celui de la
    // route (clé rl:initial-setup:*) bloque.
    checkRateLimitMock.mockImplementation(async (key: string) =>
      key.startsWith("rl:initial-setup:")
        ? { success: false, remaining: 0, reset: new Date(Date.now() + 60_000) }
        : { success: true, remaining: 100, reset: new Date(Date.now() + 60_000) }
    );

    const res = await post(VALID_BODY);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toContain("Trop de tentatives");
  });

  it("retourne 413 si le body dépasse 10 Ko", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await post({ ...VALID_BODY, note: "x".repeat(11_000) });
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe("Données trop volumineuses");
  });

  it("retourne 400 si les mots de passe ne correspondent pas", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await post({ ...VALID_BODY, confirmPassword: "AutrePassw0rd!" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Données invalides");
  });

  it("retourne 400 sur un mot de passe faible", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await post({ ...VALID_BODY, password: "faible", confirmPassword: "faible" });
    expect(res.status).toBe(400);
  });

  it("retourne 409 si le système est déjà configuré", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
      const tx = { user: { count: vi.fn().mockResolvedValue(1) } };
      return (fn as (t: typeof tx) => Promise<unknown>)(tx);
    });

    const res = await post(VALID_BODY);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("déjà été configuré");
  });

  it("retourne 400 si l'email est déjà pris", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
      const tx = {
        user: {
          count: vi.fn().mockResolvedValue(0),
          findUnique: vi.fn().mockResolvedValue({ id: cuid("user1"), email: "admin@edupilot.app" }),
        },
      };
      return (fn as (t: typeof tx) => Promise<unknown>)(tx);
    });

    const res = await post(VALID_BODY);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Cet email est déjà utilisé");
  });

  it("crée le super admin et journalise l'audit", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: unknown) => (fn as (tx: typeof prisma) => Promise<unknown>)(prisma)
    );
    vi.mocked(prisma.user.count).mockResolvedValue(0);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: cuid("userroot"),
      email: "admin@edupilot.app",
      firstName: "Jean",
      lastName: "Nouvel",
      role: "SUPER_ADMIN",
    } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: "log1" } as never);

    const res = await post(VALID_BODY);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message).toBe("Configuration initiale réussie");
    expect(body.user.email).toBe("admin@edupilot.app");
    expect(vi.mocked(prisma.user.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "admin@edupilot.app", role: "SUPER_ADMIN", isActive: true }),
      })
    );
    expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "INITIAL_SETUP_COMPLETED" }) })
    );
  });

  it("retourne 500 en cas d'erreur interne", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("db down"));

    const res = await post(VALID_BODY);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("configuration");
  });
});