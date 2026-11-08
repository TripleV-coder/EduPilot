import { describe, it, expect, vi } from "vitest";
import { totpCode } from "@/lib/auth/totp";

vi.mock("@/lib/utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { generateSecret, verifyToken } from "@/lib/auth/two-factor";

/** Chaîne 2FA réelle (sans double) : secret généré, code calculé, vérification. */
describe("two-factor — TOTP réel", () => {
  it("generateSecret produit un secret Base32 exploitable", () => {
    const { secret, otpauth } = generateSecret("prof@ecole.bj");
    expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
    expect(otpauth).toContain(`secret=${secret}`);
  });

  it("verifyToken accepte un TOTP valide", async () => {
    const secret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
    expect(await verifyToken(totpCode(secret), secret)).toBe(true);
  });

  it("le secret généré produit des codes acceptés (QR code → application → connexion)", async () => {
    const { secret } = generateSecret("prof@ecole.bj");
    expect(await verifyToken(totpCode(secret), secret)).toBe(true);
    // Dérive d'horloge du téléphone : une période d'écart tolérée, pas deux
    expect(await verifyToken(totpCode(secret, Date.now() - 30_000), secret)).toBe(true);
    expect(await verifyToken(totpCode(secret, Date.now() - 90_000), secret)).toBe(false);
  });

  it("refuse un TOTP erroné", async () => {
    expect(await verifyToken("000000", "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP")).toBe(false);
  });
});
