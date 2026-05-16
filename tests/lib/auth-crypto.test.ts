import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { encryptSecret, decryptSecret, isEncrypted } from "@/lib/auth/crypto";

const TEST_KEY = "a".repeat(64); // 32 octets hex

describe("auth/crypto (AES-256-GCM)", () => {
  const originalKey = process.env.TOTP_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.TOTP_ENCRYPTION_KEY = TEST_KEY;
  });

  afterAll(() => {
    process.env.TOTP_ENCRYPTION_KEY = originalKey;
  });

  it("encrypts and decrypts a roundtrip", () => {
    const plain = "JBSWY3DPEHPK3PXP";
    const cipher = encryptSecret(plain);
    expect(cipher).not.toBe(plain);
    expect(decryptSecret(cipher)).toBe(plain);
  });

  it("produces different ciphertext for the same plaintext (random IV)", () => {
    const plain = "same-value";
    const a = encryptSecret(plain);
    const b = encryptSecret(plain);
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(plain);
    expect(decryptSecret(b)).toBe(plain);
  });

  it("returns null on invalid format", () => {
    expect(decryptSecret("not-a-cipher")).toBeNull();
    expect(decryptSecret("abc:def")).toBeNull();
    expect(decryptSecret("")).toBeNull();
  });

  it("returns null on tampered ciphertext (auth tag check)", () => {
    const cipher = encryptSecret("safe");
    const parts = cipher.split(":");
    parts[2] = parts[2].replace(/.$/, (c) => (c === "0" ? "1" : "0"));
    const tampered = parts.join(":");
    expect(decryptSecret(tampered)).toBeNull();
  });

  it("throws when key is missing/invalid length", () => {
    process.env.TOTP_ENCRYPTION_KEY = "tooshort";
    expect(() => encryptSecret("x")).toThrow(/TOTP_ENCRYPTION_KEY/);
    process.env.TOTP_ENCRYPTION_KEY = TEST_KEY;
  });

  describe("isEncrypted", () => {
    it("detects valid encrypted format", () => {
      const cipher = encryptSecret("plain");
      expect(isEncrypted(cipher)).toBe(true);
    });

    it("rejects non-hex content", () => {
      expect(isEncrypted("abcd:efgh:ijkl")).toBe(false);
      expect(isEncrypted("plain text")).toBe(false);
      expect(isEncrypted("aa:bb")).toBe(false);
    });
  });
});
