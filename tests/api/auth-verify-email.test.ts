import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid } from "./test-helpers";

const { checkRateLimitMock, sendEmailMock } = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(),
  sendEmailMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    verificationToken: { findUnique: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn(), updateMany: vi.fn() },
  },
}));
// L3 : `@/lib/rate-limit` est désormais le module unique (limiteurs, clés,
// mappage de routes, identifiant client). Mock PARTIEL : seule la fonction
// contrôlée par ce test est remplacée, tout le reste garde son code réel.
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  checkRateLimit: checkRateLimitMock,
}));
// @/lib/email charge nodemailer → mock au niveau module.
vi.mock("@/lib/email", () => ({
  sendEmail: sendEmailMock,
  sendWelcomeEmail: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { GET, POST } from "@/app/api/auth/verify-email/route";

const EMAIL = "awa@school.bj";
const TOKEN = "verif-token-hex";

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockResolvedValue({ success: true, remaining: 3, reset: new Date() });
  sendEmailMock.mockResolvedValue(true);
});

describe("GET /api/auth/verify-email", () => {
  it("retourne 400 si le token manque", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost:3000/api/auth/verify-email"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Token manquant");
  });

  it("retourne 404 si le token est inconnu", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.verificationToken.findUnique).mockResolvedValue(null);

    const res = await GET(makeRequest(`http://localhost:3000/api/auth/verify-email?token=${TOKEN}`));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Token invalide ou expiré");
  });

  it("supprime un token expiré et retourne 410", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.verificationToken.findUnique).mockResolvedValue({
      identifier: EMAIL,
      token: TOKEN,
      expires: new Date(Date.now() - 1000),
    } as never);
    vi.mocked(prisma.verificationToken.delete).mockResolvedValue({} as never);

    const res = await GET(makeRequest(`http://localhost:3000/api/auth/verify-email?token=${TOKEN}`));
    expect(res.status).toBe(410);
    expect((await res.json()).error).toContain("expiré");
    expect(vi.mocked(prisma.verificationToken.delete)).toHaveBeenCalledWith({ where: { token: TOKEN } });
  });

  it("valide le token, marque l'email vérifié et redirige", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.verificationToken.findUnique).mockResolvedValue({
      identifier: EMAIL,
      token: TOKEN,
      expires: new Date(Date.now() + 60 * 60 * 1000),
    } as never);
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.verificationToken.delete).mockResolvedValue({} as never);
    process.env.NEXT_PUBLIC_APP_URL = "https://edupilot.test";

    const res = await GET(makeRequest(`http://localhost:3000/api/auth/verify-email?token=${TOKEN}`));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://edupilot.test/login?verified=1");
    expect(vi.mocked(prisma.user.updateMany)).toHaveBeenCalledWith({
      where: { email: EMAIL },
      data: { emailVerified: expect.any(Date) },
    });
  });

  it("retourne 500 si la lecture échoue", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.verificationToken.findUnique).mockRejectedValue(new Error("db down"));

    const res = await GET(makeRequest(`http://localhost:3000/api/auth/verify-email?token=${TOKEN}`));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/auth/verify-email", () => {
  function post(body: Record<string, unknown>) {
    return POST(
      makeRequest("http://localhost:3000/api/auth/verify-email", { method: "POST", body })
    );
  }

  it("retourne 429 quand le rate limit est atteint", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    checkRateLimitMock.mockResolvedValue({ success: false, remaining: 0, reset: new Date() });

    const res = await post({ email: EMAIL });
    expect(res.status).toBe(429);
    expect((await res.json()).error).toContain("Trop de requêtes");
  });

  it("retourne 400 si aucun email n'est fourni", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await post({});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Email requis");
  });

  it("répond success sans énumération si le compte n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await post({ email: EMAIL });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain("Si votre compte existe");
    expect(prisma.verificationToken.create).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("ne renvoie rien si l'email est déjà vérifié", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: cuid("user1"),
      email: EMAIL,
      firstName: "Awa",
      emailVerified: new Date(),
      isActive: true,
    } as never);

    const res = await post({ email: EMAIL });
    expect(res.status).toBe(200);
    expect((await res.json()).message).toContain("déjà vérifié");
    expect(prisma.verificationToken.create).not.toHaveBeenCalled();
  });

  it("crée un token et envoie l'email de vérification", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: cuid("user1"),
      email: EMAIL,
      firstName: "Awa",
      emailVerified: null,
      isActive: true,
    } as never);
    vi.mocked(prisma.verificationToken.deleteMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.verificationToken.create).mockResolvedValue({ token: TOKEN } as never);
    process.env.NEXT_PUBLIC_APP_URL = "https://edupilot.test";

    const res = await post({ email: "Awa@School.BJ" });
    expect(res.status).toBe(200);
    expect((await res.json()).message).toContain("envoyé");
    expect(vi.mocked(prisma.verificationToken.deleteMany)).toHaveBeenCalledWith({
      where: { identifier: EMAIL },
    });
    expect(vi.mocked(prisma.verificationToken.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ identifier: EMAIL, token: expect.any(String) }),
      })
    );
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: EMAIL,
        subject: expect.stringContaining("EduPilot"),
        html: expect.stringContaining("https://edupilot.test/api/auth/verify-email?token="),
      })
    );
  });

  it("retourne 500 en cas d'erreur interne", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("db down"));

    const res = await post({ email: EMAIL });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur interne");
  });
});