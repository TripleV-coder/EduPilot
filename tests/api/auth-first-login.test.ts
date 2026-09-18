import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, cuid } from "./test-helpers";

const { checkRateLimitMock } = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    firstLoginToken: { findUnique: vi.fn(), update: vi.fn() },
    user: { update: vi.fn() },
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
// bcryptjs : hash/compare réels inutiles ici → mock au niveau module.
// La route utilise l'import par défaut : on expose compare/hash via default.
const { bcryptCompareMock, bcryptHashMock } = vi.hoisted(() => ({
  bcryptCompareMock: vi.fn(),
  bcryptHashMock: vi.fn().mockResolvedValue("hashed-new"),
}));
vi.mock("bcryptjs", () => ({
  default: { compare: bcryptCompareMock, hash: bcryptHashMock },
  compare: bcryptCompareMock,
  hash: bcryptHashMock,
}));

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { GET, POST } from "@/app/api/auth/first-login/route";

const TOKEN = "first-login-token-abc";
const USER_ID = cuid("userfirst");

function tokenRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: cuid("token1"),
    token: TOKEN,
    userId: USER_ID,
    tempPassword: "TEMP-PASSWORD",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    usedAt: null,
    user: {
      id: USER_ID,
      email: "awa@school.bj",
      firstName: "Awa",
      lastName: "Dossou",
      role: "PARENT",
      password: "old-hash",
    },
    ...overrides,
  } as never;
}

const NEW_PASSWORD = "NewPassw0rd!";

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockResolvedValue({ success: true, remaining: 3, reset: new Date(Date.now() + 60_000) });
});

describe("GET /api/auth/first-login", () => {
  it("retourne 400 si le token manque", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost:3000/api/auth/first-login"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Token manquant");
  });

  it("retourne 404 si le token est inconnu", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.firstLoginToken.findUnique).mockResolvedValue(null);

    const res = await GET(makeRequest(`http://localhost:3000/api/auth/first-login?token=${TOKEN}`));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Token invalide");
  });

  it("retourne 410 si le token est expiré", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.firstLoginToken.findUnique).mockResolvedValue(
      tokenRecord({ expiresAt: new Date(Date.now() - 1000) })
    );

    const res = await GET(makeRequest(`http://localhost:3000/api/auth/first-login?token=${TOKEN}`));
    expect(res.status).toBe(410);
  });

  it("retourne 410 si le token a déjà été utilisé", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.firstLoginToken.findUnique).mockResolvedValue(
      tokenRecord({ usedAt: new Date() })
    );

    const res = await GET(makeRequest(`http://localhost:3000/api/auth/first-login?token=${TOKEN}`));
    expect(res.status).toBe(410);
    expect((await res.json()).error).toContain("déjà été utilisé");
  });

  it("retourne l'utilisateur pour un token valide", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.firstLoginToken.findUnique).mockResolvedValue(tokenRecord());

    const res = await GET(makeRequest(`http://localhost:3000/api/auth/first-login?token=${TOKEN}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.email).toBe("awa@school.bj");
  });

  it("retourne 500 si la lecture échoue", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.firstLoginToken.findUnique).mockRejectedValue(new Error("db down"));

    const res = await GET(makeRequest(`http://localhost:3000/api/auth/first-login?token=${TOKEN}`));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/auth/first-login", () => {
  function post(body: Record<string, unknown>) {
    return POST(
      makeRequest("http://localhost:3000/api/auth/first-login", { method: "POST", body })
    );
  }

  it("retourne 429 quand le rate limit est atteint", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    checkRateLimitMock.mockResolvedValue({ success: false, remaining: 0, reset: new Date(Date.now() + 60_000) });

    const res = await post({ token: TOKEN, currentPassword: "toto", newPassword: NEW_PASSWORD });
    expect(res.status).toBe(429);
  });

  it("retourne 400 sur un mot de passe faible", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await post({ token: TOKEN, newPassword: "faible" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Données invalides");
  });

  it("retourne 400 si le token est invalide ou expiré", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.firstLoginToken.findUnique).mockResolvedValue(null);

    const res = await post({ token: TOKEN, newPassword: NEW_PASSWORD });
    expect(res.status).toBe(400);
  });

  it("retourne 400 si le token a déjà été utilisé", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.firstLoginToken.findUnique).mockResolvedValue(tokenRecord({ usedAt: new Date() }));

    const res = await post({ token: TOKEN, newPassword: NEW_PASSWORD });
    expect(res.status).toBe(400);
  });

  it("retourne 400 si le mot de passe temporaire est requis mais absent", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.firstLoginToken.findUnique).mockResolvedValue(tokenRecord());

    const res = await post({ token: TOKEN, newPassword: NEW_PASSWORD });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Mot de passe temporaire requis");
  });

  it("retourne 401 si le mot de passe temporaire est incorrect", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.firstLoginToken.findUnique).mockResolvedValue(tokenRecord());
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const res = await post({ token: TOKEN, currentPassword: "mauvais", newPassword: NEW_PASSWORD });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Mot de passe temporaire incorrect");
  });

  it("retourne 400 si le nouveau mot de passe est identique à l'ancien", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.firstLoginToken.findUnique).mockResolvedValue(tokenRecord());
    // temp valide (2 comparaisons) + nouveau == ancien
    vi.mocked(bcrypt.compare)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    const res = await post({ token: TOKEN, currentPassword: "temp", newPassword: NEW_PASSWORD });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("différent");
  });

  it("change le mot de passe et marque le token utilisé (magic link sans tempPassword)", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.firstLoginToken.findUnique).mockResolvedValue(
      tokenRecord({ tempPassword: null })
    );
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: unknown) => (fn as (tx: typeof prisma) => Promise<unknown>)(prisma)
    );
    vi.mocked(prisma.user.update).mockResolvedValue({ id: USER_ID } as never);
    vi.mocked(prisma.firstLoginToken.update).mockResolvedValue({ id: cuid("token1") } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: "log1" } as never);

    const res = await post({ token: TOKEN, newPassword: NEW_PASSWORD });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(vi.mocked(prisma.user.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: expect.objectContaining({ password: "hashed-new", emailVerified: expect.any(Date) }),
      })
    );
    expect(vi.mocked(prisma.firstLoginToken.update)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: cuid("token1") }, data: expect.objectContaining({ usedAt: expect.any(Date) }) })
    );
    expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "PASSWORD_CHANGED_FIRST_LOGIN" }) })
    );
  });

  it("valide le mot de passe temporaire avant de changer le mot de passe", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.firstLoginToken.findUnique).mockResolvedValue(tokenRecord());
    vi.mocked(bcrypt.compare).mockImplementation(
      async (candidate: string) => candidate !== NEW_PASSWORD
    );
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: unknown) => (fn as (tx: typeof prisma) => Promise<unknown>)(prisma)
    );
    vi.mocked(prisma.user.update).mockResolvedValue({ id: USER_ID } as never);
    vi.mocked(prisma.firstLoginToken.update).mockResolvedValue({ id: cuid("token1") } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: "log1" } as never);

    const res = await post({ token: TOKEN, currentPassword: "TEMP-PASSWORD", newPassword: NEW_PASSWORD });
    expect(res.status).toBe(200);
    // normalizeTempPassword supprime le tiret et met en majuscules
    expect(bcrypt.compare).toHaveBeenCalledWith("TEMPPASSWORD", "TEMP-PASSWORD");
  });

  it("retourne 500 en cas d'erreur interne", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.firstLoginToken.findUnique).mockRejectedValue(new Error("db down"));

    const res = await post({ token: TOKEN, newPassword: NEW_PASSWORD });
    expect(res.status).toBe(500);
  });
});