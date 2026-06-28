import { describe, it, expect } from "vitest";
import {
    generateLinkCode,
    normalizeLinkCode,
    hashLinkCode,
    verifyLinkCode,
    linkCodeExpiry,
    LINK_CODE_TTL_MS,
} from "@/lib/parents/link-code";

describe("generateLinkCode", () => {
    it("produit 8 caractères de l'alphabet non ambigu", () => {
        for (let i = 0; i < 50; i++) {
            const code = generateLinkCode();
            expect(code).toHaveLength(8);
            expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
        }
    });

    it("génère des codes distincts (entropie)", () => {
        const codes = new Set(Array.from({ length: 100 }, () => generateLinkCode()));
        expect(codes.size).toBeGreaterThan(95);
    });
});

describe("normalizeLinkCode", () => {
    it("met en majuscules et retire espaces/tirets", () => {
        expect(normalizeLinkCode("k7m2-qp rx")).toBe("K7M2QPRX");
    });
});

describe("hash/verify", () => {
    it("vérifie un code correct, indépendamment de la casse/espaces", async () => {
        const code = "K7M2QPRX";
        const hash = await hashLinkCode(code);
        expect(await verifyLinkCode("k7m2 qprx", hash)).toBe(true);
        expect(await verifyLinkCode("XXXXXXXX", hash)).toBe(false);
    });
});

describe("linkCodeExpiry", () => {
    it("expire 14 jours après l'émission", () => {
        const now = 1_000_000;
        expect(linkCodeExpiry(now).getTime()).toBe(now + LINK_CODE_TTL_MS);
    });
});
