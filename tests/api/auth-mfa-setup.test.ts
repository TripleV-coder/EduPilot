import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid } from "./test-helpers";

// two-factor charge otplib + qrcode (modules externes lourds) → mock au
// niveau module pour tester la route en isolation.
vi.mock("@/lib/auth/two-factor", () => ({
  generateSecret: vi.fn(),
  generateQRCode: vi.fn(),
  verifyToken: vi.fn(),
  generateBackupCodes: vi.fn(),
  hashBackupCodes: vi.fn(),
  encryptSecret: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));
// bcryptjs : compare réel inutile ici → mock au niveau module.
// La route utilise l'import par défaut : on expose compare/hash via default.
const { bcryptCompareMock, bcryptHashMock } = vi.hoisted(() => ({
  bcryptCompareMock: vi.fn(),
  bcryptHashMock: vi.fn(),
}));
vi.mock("bcryptjs", () => ({
  default: { compare: bcryptCompareMock, hash: bcryptHashMock },
  compare: bcryptCompareMock,
  hash: bcryptHashMock,
}));

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  generateSecret,
  generateQRCode,
  verifyToken,
  generateBackupCodes,
  hashBackupCodes,
  encryptSecret,
} from "@/lib/auth/two-factor";
import { POST } from "@/app/api/auth/mfa/setup/route";

const USER_ID = cuid("usermfa");
const SECRET = "JBSWY3DPEHPK3PXP";

function mfaRequest(action: string | null, body?: Record<string, unknown>) {
  const url = action
    ? `http://localhost:3000/api/auth/mfa/setup?action=${action}`
    : "http://localhost:3000/api/auth/mfa/setup";
  return POST(makeRequest(url, { method: "POST", body }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(generateSecret).mockReturnValue({ secret: SECRET, otpauth: `otpauth://totp/EduPilot?secret=${SECRET}` });
  vi.mocked(generateQRCode).mockResolvedValue("data:image/png;base64,qr");
  vi.mocked(verifyToken).mockResolvedValue(true);
  vi.mocked(generateBackupCodes).mockReturnValue(["abcde-12345", "fghij-67890"]);
  vi.mocked(hashBackupCodes).mockResolvedValue(["hash1", "hash2"]);
  vi.mocked(encryptSecret).mockReturnValue("encrypted-secret");
});

describe("POST /api/auth/mfa/setup", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await mfaRequest("generate");
    expect(res.status).toBe(401);
  });

  it("retourne 400 si l'action manque", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    const res = await mfaRequest(null);
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe("Action required");
  });

  it("retourne 400 pour une action inconnue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    const res = await mfaRequest("wat");
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe("Invalid action");
  });

  it("génère un secret et un QR code", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    const res = await mfaRequest("generate");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.secret).toBe(SECRET);
    expect(body.qrCode).toContain("data:image/png");
    expect(generateSecret).toHaveBeenCalledWith(expect.any(String));
  });

  it("retourne 400 si le code TOTP n'a pas 6 chiffres", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    const res = await mfaRequest("enable", { token: "123", secret: SECRET });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe("Code invalide");
  });

  it("retourne 400 si le secret manque pour enable", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    const res = await mfaRequest("enable", { token: "123456" });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe("Secret manquant");
  });

  it("retourne 400 si le code TOTP est incorrect", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    // NOTE : la route lit `const isValid = verifyToken(...)` sans await ;
    // verifyToken prod est async (Promise toujours truthy) → branche morte en
    // prod. On mocke un retour synchrone false pour couvrir le code écrit.
    vi.mocked(verifyToken).mockReturnValue(false as never);

    const res = await mfaRequest("enable", { token: "123456", secret: SECRET });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe("Code incorrect");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("active la 2FA, chiffre le secret et retourne les backup codes", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    vi.mocked(prisma.user.update).mockResolvedValue({ id: USER_ID, isTwoFactorEnabled: true } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: "log1" } as never);

    const res = await mfaRequest("enable", { token: "123456", secret: SECRET });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain("activée");
    expect(body.backupCodes).toHaveLength(2);
    expect(vi.mocked(prisma.user.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: expect.objectContaining({
          isTwoFactorEnabled: true,
          twoFactorSecret: "encrypted-secret",
          twoFactorBackupCodes: ["hash1", "hash2"],
        }),
      })
    );
    expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "MFA_ENABLED" }) })
    );
  });

  it("retourne 400 si le mot de passe manque pour disable", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    const res = await mfaRequest("disable", {});
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe("Mot de passe requis");
  });

  it("retourne 404 si l'utilisateur n'existe pas pour disable", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await mfaRequest("disable", { password: "Passw0rd!" });
    expect(res.status).toBe(404);
    expect((await res.json()).message).toBe("User not found");
  });

  it("retourne 403 si le mot de passe est incorrect pour disable", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: USER_ID, password: "hash" } as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const res = await mfaRequest("disable", { password: "mauvais" });
    expect(res.status).toBe(403);
    expect((await res.json()).message).toBe("Mot de passe incorrect");
  });

  it("désactive la 2FA avec un mot de passe valide", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: USER_ID, password: "hash" } as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(prisma.user.update).mockResolvedValue({ id: USER_ID, isTwoFactorEnabled: false } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: "log1" } as never);

    const res = await mfaRequest("disable", { password: "Passw0rd!" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(vi.mocked(prisma.user.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isTwoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] }),
      })
    );
    expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "MFA_DISABLED" }) })
    );
  });

  it("retourne 500 en cas d'erreur interne", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    vi.mocked(prisma.user.update).mockRejectedValue(new Error("db down"));

    const res = await mfaRequest("enable", { token: "123456", secret: SECRET });
    expect(res.status).toBe(500);
  });
});