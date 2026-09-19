import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, cuid } from "./test-helpers";

const { checkRateLimitMock } = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    passwordResetToken: { findUnique: vi.fn(), delete: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));
// L3 : `@/lib/rate-limit` est désormais le module unique (limiteurs, clés,
// mappage de routes, identifiant client). Mock PARTIEL : seule la fonction
// contrôlée par ce test est remplacée, tout le reste garde son code réel.
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  checkRateLimit: checkRateLimitMock,
}));
// bcryptjs : hash réel coûteux → mock au niveau module.
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
import { GET, POST } from "@/app/api/auth/reset-password/route";

const TOKEN = "reset-token-abc";
const USER_ID = cuid("userreset");

function resetToken(overrides: Record<string, unknown> = {}) {
  return {
    id: cuid("reset1"),
    token: TOKEN,
    email: "awa@school.bj",
    userId: USER_ID,
    expires: new Date(Date.now() + 60 * 60 * 1000),
    ...overrides,
  } as never;
}

const PASSWORD = "NewPassw0rd!";

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockResolvedValue({ success: true, remaining: 3, reset: new Date() });
});

describe("GET /api/auth/reset-password", () => {
  it("retourne 400 si le token manque", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost:3000/api/auth/reset-password"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Token requis");
  });

  it("retourne valid=false pour un token inconnu", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(null);

    const res = await GET(makeRequest(`http://localhost:3000/api/auth/reset-password?token=${TOKEN}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.error).toBe("Token invalide");
  });

  it("retourne valid=false pour un token expiré", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(
      resetToken({ expires: new Date(Date.now() - 1000) })
    );

    const res = await GET(makeRequest(`http://localhost:3000/api/auth/reset-password?token=${TOKEN}`));
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.error).toBe("Token expiré");
  });

  it("retourne valid=true pour un token valide", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(resetToken());

    const res = await GET(makeRequest(`http://localhost:3000/api/auth/reset-password?token=${TOKEN}`));
    const body = await res.json();
    expect(body.valid).toBe(true);
  });

  it("retourne valid=false avec 500 si la lecture échoue", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.passwordResetToken.findUnique).mockRejectedValue(new Error("db down"));

    const res = await GET(makeRequest(`http://localhost:3000/api/auth/reset-password?token=${TOKEN}`));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.valid).toBe(false);
  });
});

describe("POST /api/auth/reset-password", () => {
  function post(body: Record<string, unknown>) {
    return POST(
      makeRequest("http://localhost:3000/api/auth/reset-password", { method: "POST", body })
    );
  }

  it("retourne 429 quand le rate limit est atteint", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    checkRateLimitMock.mockResolvedValue({ success: false, remaining: 0, reset: new Date() });

    const res = await post({ token: TOKEN, password: PASSWORD });
    expect(res.status).toBe(429);
    expect((await res.json()).error).toContain("Trop de requêtes");
  });

  it("retourne 400 sur un mot de passe faible", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await post({ token: TOKEN, password: "faible" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Données invalides");
  });

  it("retourne 400 si le token est inconnu", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(null);

    const res = await post({ token: TOKEN, password: PASSWORD });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Token invalide ou expiré");
  });

  it("supprime le token expiré et retourne 400", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(
      resetToken({ expires: new Date(Date.now() - 1000) })
    );
    vi.mocked(prisma.passwordResetToken.delete).mockResolvedValue({ id: cuid("reset1") } as never);

    const res = await post({ token: TOKEN, password: PASSWORD });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("expiré");
    expect(vi.mocked(prisma.passwordResetToken.delete)).toHaveBeenCalledWith({ where: { id: cuid("reset1") } });
  });

  it("retourne 404 si l'utilisateur n'existe plus", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(resetToken());
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await post({ token: TOKEN, password: PASSWORD });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Utilisateur non trouvé");
  });

  it("invalide un token dont le userId ne correspond plus au compte", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(
      resetToken({ userId: cuid("userother") })
    );
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: USER_ID, email: "awa@school.bj" } as never);
    vi.mocked(prisma.passwordResetToken.delete).mockResolvedValue({ id: cuid("reset1") } as never);

    const res = await post({ token: TOKEN, password: PASSWORD });
    expect(res.status).toBe(400);
    expect(vi.mocked(prisma.passwordResetToken.delete)).toHaveBeenCalled();
  });

  it("réinitialise le mot de passe et journalise l'audit", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(resetToken());
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: USER_ID, email: "awa@school.bj" } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({ id: USER_ID } as never);
    vi.mocked(prisma.passwordResetToken.delete).mockResolvedValue({ id: cuid("reset1") } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: "log1" } as never);

    const res = await post({ token: TOKEN, password: PASSWORD });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(vi.mocked(prisma.user.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: expect.objectContaining({ password: "hashed-new", passwordChangedAt: expect.any(Date) }),
      })
    );
    expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "PASSWORD_RESET_SUCCESS" }) })
    );
  });

  it("retourne 500 en cas d'erreur interne", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.passwordResetToken.findUnique).mockRejectedValue(new Error("db down"));

    const res = await post({ token: TOKEN, password: PASSWORD });
    expect(res.status).toBe(500);
  });
});