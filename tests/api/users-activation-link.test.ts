import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn() },
    firstLoginToken: { deleteMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
// @/lib/email charge nodemailer → mock au niveau module.
vi.mock("@/lib/email", () => ({ sendActivationEmail: vi.fn() }));
vi.mock("@/lib/security/audit-log", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import prisma from "@/lib/prisma";
import { sendActivationEmail } from "@/lib/email";
import { createAuditLog } from "@/lib/security/audit-log";
import { hashActivationToken } from "@/lib/auth/activation-link";
import { POST } from "@/app/api/users/[id]/activation-link/route";

const TARGET_ID = cuid("targetparent");

function target(overrides: Record<string, unknown> = {}) {
  return {
    id: TARGET_ID,
    email: "awa@famille.bj",
    firstName: "Awa",
    role: "PARENT",
    schoolId: FIXTURES.schoolA,
    isActive: true,
    mustChangePassword: true,
    school: { name: "CEG Akpakpa" },
    ...overrides,
  } as never;
}

function issue(id = TARGET_ID) {
  return POST(
    makeRequest(`http://localhost:3000/api/users/${id}/activation-link`, { method: "POST" }),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockResolvedValue([] as never);
  vi.mocked(sendActivationEmail).mockResolvedValue(true);
});

describe("POST /api/users/[id]/activation-link", () => {
  it("refuse les rôles hors direction", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await issue();
    expect(res.status).toBe(403);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("répond 404 pour un compte d'une autre école (souveraineté)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(target({ schoolId: FIXTURES.schoolB }));
    const res = await issue();
    expect(res.status).toBe(404);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuse un rôle que l'appelant ne peut pas créer", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(target({ role: "ACCOUNTANT" }));
    const res = await issue();
    expect(res.status).toBe(403);
  });

  it("refuse un compte déjà activé : la direction ne remplace pas un mot de passe choisi", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(target({ mustChangePassword: false }));
    const res = await issue();
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("déjà activé");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuse un compte désactivé", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(target({ isActive: false }));
    const res = await issue();
    expect(res.status).toBe(409);
  });

  it("émet un lien à usage unique, ne stocke que son empreinte et l'envoie par e-mail", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(target());

    const res = await issue();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    const body = await res.json();
    expect(body.emailSent).toBe(true);
    const token = new URL(body.link).searchParams.get("token");
    expect(new URL(body.link).pathname).toBe("/first-login");
    expect(token).toBeTruthy();

    // Les liens précédents non utilisés sont annulés ; seule l'empreinte est stockée.
    expect(prisma.firstLoginToken.deleteMany).toHaveBeenCalledWith({ where: { userId: TARGET_ID, usedAt: null } });
    const created = vi.mocked(prisma.firstLoginToken.create).mock.calls[0][0] as { data: { token: string; tempPassword: null; expiresAt: Date } };
    expect(created.data.token).toBe(hashActivationToken(token!));
    expect(created.data.token).not.toBe(token);
    expect(created.data.tempPassword).toBeNull();
    const ttlHours = (created.data.expiresAt.getTime() - Date.now()) / 3_600_000;
    expect(ttlHours).toBeGreaterThan(71.9);
    expect(ttlHours).toBeLessThanOrEqual(72);

    expect(sendActivationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: "awa@famille.bj", schoolName: "CEG Akpakpa", activationUrl: body.link }),
    );
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ACTIVATION_LINK_ISSUED", entityId: TARGET_ID, schoolId: FIXTURES.schoolA }),
    );
  });

  it("renvoie quand même le lien si l'e-mail ne part pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(target());
    vi.mocked(sendActivationEmail).mockRejectedValue(new Error("smtp down"));

    const res = await issue();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.emailSent).toBe(false);
    expect(body.link).toContain("/first-login?token=");
  });
});
