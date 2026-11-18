import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateTotpSecret, hotp, totpCode, verifyTotpCode } from "@/lib/auth/totp";

/** Vecteurs de test officiels : RFC 4648 (Base32), RFC 4226 (HOTP), RFC 6238 annexe B (TOTP). */
describe("Base32 (RFC 4648 §10)", () => {
    it.each([
        ["", ""],
        ["f", "MY"],
        ["fo", "MZXQ"],
        ["foo", "MZXW6"],
        ["foob", "MZXW6YQ"],
        ["fooba", "MZXW6YTB"],
        ["foobar", "MZXW6YTBOI"],
    ])("%j ↔ %s", (plain, encoded) => {
        expect(base32Encode(Buffer.from(plain))).toBe(encoded);
        expect(base32Decode(encoded).toString()).toBe(plain);
    });

    it("tolère minuscules, espaces et remplissage (secret recopié à la main)", () => {
        expect(base32Decode("mzxw 6ytb oi======").toString()).toBe("foobar");
    });

    it("refuse un caractère hors alphabet", () => {
        expect(() => base32Decode("MZXW1")).toThrow("Base32");
    });
});

describe("HOTP (RFC 4226, annexe D)", () => {
    const key = Buffer.from("12345678901234567890");
    const expected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
    it.each(expected.map((code, counter) => [counter, code]))("compteur %i → %s", (counter, code) => {
        expect(hotp(key, counter as number)).toBe(code);
    });
});

describe("TOTP (RFC 6238, annexe B)", () => {
    const keys = {
        sha1: Buffer.from("12345678901234567890"),
        sha256: Buffer.from("12345678901234567890123456789012"),
        sha512: Buffer.from("1234567890123456789012345678901234567890123456789012345678901234"),
    } as const;
    const vectors: [number, string, string, string][] = [
        [59, "94287082", "46119246", "90693936"],
        [1111111109, "07081804", "68084774", "25091201"],
        [1111111111, "14050471", "67062674", "99943326"],
        [1234567890, "89005924", "91819424", "93441116"],
        [2000000000, "69279037", "90698825", "38618901"],
        [20000000000, "65353130", "77737706", "47863826"],
    ];
    it.each(vectors)("T = %i s", (seconds, sha1, sha256, sha512) => {
        const counter = Math.floor(seconds / 30);
        expect(hotp(keys.sha1, counter, 8, "sha1")).toBe(sha1);
        expect(hotp(keys.sha256, counter, 8, "sha256")).toBe(sha256);
        expect(hotp(keys.sha512, counter, 8, "sha512")).toBe(sha512);
    });

    it("totpCode : 6 chiffres sur la clé Base32 (même calcul que les applications)", () => {
        const secret = base32Encode(keys.sha1);
        expect(totpCode(secret, 59_000)).toBe("287082");
        expect(totpCode(secret, 1_111_111_109_000)).toBe("081804");
    });
});

describe("verifyTotpCode", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    const now = 1_111_111_109_000;

    it("accepte la période en cours et une période d'écart, pas deux", () => {
        expect(verifyTotpCode(totpCode(secret, now), secret, { nowMs: now })).toBe(true);
        expect(verifyTotpCode(totpCode(secret, now - 30_000), secret, { nowMs: now })).toBe(true);
        expect(verifyTotpCode(totpCode(secret, now + 30_000), secret, { nowMs: now })).toBe(true);
        expect(verifyTotpCode(totpCode(secret, now - 60_000), secret, { nowMs: now })).toBe(false);
        expect(verifyTotpCode(totpCode(secret, now + 60_000), secret, { nowMs: now })).toBe(false);
    });

    it("refuse un code mal formé, et un secret vide", () => {
        const code = totpCode(secret, now);
        for (const token of ["", "12345", "1234567", `${code.slice(0, 5)}a`, ` ${code}`]) {
            expect(verifyTotpCode(token, secret, { nowMs: now })).toBe(false);
        }
        expect(verifyTotpCode(code, "", { nowMs: now })).toBe(false);
    });

    it("secret généré : 160 bits en Base32 (32 caractères), jamais deux fois le même", () => {
        const a = generateTotpSecret();
        const b = generateTotpSecret();
        expect(a).toMatch(/^[A-Z2-7]{32}$/);
        expect(base32Decode(a)).toHaveLength(20);
        expect(a).not.toBe(b);
    });
});
