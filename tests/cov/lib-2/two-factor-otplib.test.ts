import { describe, it, expect, vi } from "vitest";
import { generate } from "otplib";

vi.mock("@/lib/utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { generateSecret, verifyToken } from "@/lib/auth/two-factor";

/**
 * Intégration réelle avec otplib 13 (sans double). two-factor.ts utilise encore
 * l'API d'otplib 12 : `new TOTP({ step, window })` sans greffons crypto/base32
 * et `verify({ token, secret })` au lieu de `verify(token, { secret })`.
 */
describe("two-factor — intégration otplib réelle", () => {
  it("generateSecret produit un secret Base32 exploitable", () => {
    const { secret, otpauth } = generateSecret("prof@ecole.bj");
    expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
    expect(otpauth).toContain(`secret=${secret}`);
  });

  it("verifyToken accepte un TOTP valide", async () => {
    const secret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
    const token = await generate({ secret });
    expect(await verifyToken(token, secret)).toBe(true);
  });

  it("refuse un TOTP erroné", async () => {
    expect(await verifyToken("000000", "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP")).toBe(false);
  });
});
