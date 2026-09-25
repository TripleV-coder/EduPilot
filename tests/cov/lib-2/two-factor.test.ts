import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

// Double d'otplib : un « authentificateur » déterministe (le vrai comportement
// d'otplib 13 est éprouvé dans two-factor-otplib.test.ts).
const otp = vi.hoisted(() => ({
  generateSecret: vi.fn(() => "JBSWY3DPEHPK3PXP"),
  verify: vi.fn(),
}));
vi.mock("otplib", () => ({
  TOTP: vi.fn(function () {
    return otp;
  }),
}));
vi.mock("@/lib/utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import bcrypt from "bcryptjs";
import { logger } from "@/lib/utils/logger";
import {
  generateSecret,
  generateQRCode,
  verifyToken,
  generateBackupCodes,
  hashBackupCodes,
  findMatchingBackupCode,
  encryptSecret,
} from "@/lib/auth/two-factor";

beforeAll(() => {
  process.env.TOTP_ENCRYPTION_KEY = "a".repeat(64);
});

beforeEach(() => {
  vi.clearAllMocks();
});

type VerifyArg = { token: string; secret: string };
const verifyArgs = () => otp.verify.mock.calls.map((c) => (c as unknown as [VerifyArg])[0]);

describe("generateSecret", () => {
  it("construit une URI otpauth encodée pour l'application d'authentification", () => {
    const { secret, otpauth } = generateSecret("awa+test@ecole.bj");
    expect(secret).toBe("JBSWY3DPEHPK3PXP");
    expect(otpauth).toBe(
      "otpauth://totp/EduPilot:awa%2Btest%40ecole.bj?secret=JBSWY3DPEHPK3PXP&issuer=EduPilot&algorithm=SHA1&digits=6&period=30",
    );
  });
});

describe("generateQRCode", () => {
  it("renvoie une image PNG en data URL", async () => {
    const url = await generateQRCode("otpauth://totp/EduPilot:x?secret=ABC");
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
    expect(url.length).toBeGreaterThan(100);
  });
});

describe("verifyToken", () => {
  it("déchiffre un secret stocké chiffré avant la vérification", async () => {
    otp.verify.mockReturnValueOnce(true);
    const stored = encryptSecret("SECRETCLAIR");
    expect(await verifyToken("123456", stored)).toBe(true);
    expect(verifyArgs()[0]).toMatchObject({ token: "123456", secret: "SECRETCLAIR" });
  });

  it("utilise tel quel un secret hérité stocké en clair", async () => {
    otp.verify.mockReturnValueOnce(false);
    expect(await verifyToken("654321", "LEGACYSECRET")).toBe(false);
    expect(verifyArgs()[0]).toMatchObject({ secret: "LEGACYSECRET" });
  });

  it("retombe sur la valeur stockée si le déchiffrement échoue (clé changée)", async () => {
    otp.verify.mockReturnValueOnce(false);
    const stored = encryptSecret("X");
    const [iv, tag, ct] = stored.split(":");
    const corrupted = `${iv}:${tag.replace(/^./, tag[0] === "0" ? "1" : "0")}:${ct}`;
    await verifyToken("111111", corrupted);
    expect(verifyArgs()[0].secret).toBe(corrupted);
  });

  it("renvoie false et journalise quand la vérification lève une erreur", async () => {
    otp.verify.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    expect(await verifyToken("1", "S")).toBe(false);
    expect(logger.error).toHaveBeenCalledWith("Token verification error", expect.any(Error), { module: "auth/two-factor" });
  });

  it("enveloppe dans une Error une valeur levée qui n'en est pas une", async () => {
    otp.verify.mockImplementationOnce(() => {
      throw "chaine";
    });
    expect(await verifyToken("1", "S")).toBe(false);
    const err = vi.mocked(logger.error).mock.calls[0][1] as Error;
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("chaine");
  });
});

describe("codes de secours", () => {
  it("génère 10 codes uniques au format xxxxx-xxxxx par défaut", () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(10);
    for (const c of codes) expect(c).toMatch(/^[a-z0-9]{5}-[a-z0-9]{5}$/);
    expect(new Set(codes).size).toBe(10);
  });

  it("respecte le nombre de codes demandé", () => {
    expect(generateBackupCodes(3)).toHaveLength(3);
    expect(generateBackupCodes(0)).toEqual([]);
  });

  it("hache les codes (bcrypt) et retrouve l'index du code saisi", async () => {
    const hashed = await hashBackupCodes(["aaaaa-bbbbb", "ccccc-ddddd"]);
    expect(hashed).toHaveLength(2);
    expect(hashed[0]).not.toBe("aaaaa-bbbbb");
    expect(await bcrypt.compare("aaaaa-bbbbb", hashed[0])).toBe(true);
    expect(await findMatchingBackupCode("ccccc-ddddd", hashed)).toBe(1);
    expect(await findMatchingBackupCode("zzzzz-zzzzz", hashed)).toBe(-1);
    expect(await findMatchingBackupCode("x", [])).toBe(-1);
  }, 20000);
});
