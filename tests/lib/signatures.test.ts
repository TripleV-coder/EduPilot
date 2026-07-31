import { describe, it, expect } from "vitest";
import {
    stableStringify,
    computeContentHash,
    hashIp,
    canSignDocType,
} from "@/lib/signatures/signature";

describe("stableStringify", () => {
    it("est indépendant de l'ordre des clés", () => {
        expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
    });
    it("gère tableaux et valeurs imbriquées", () => {
        expect(stableStringify({ x: [1, { c: 3, a: 1 }] })).toBe('{"x":[1,{"a":1,"c":3}]}');
    });
});

describe("computeContentHash", () => {
    it("est déterministe et indépendant de l'ordre des clés du payload", () => {
        const a = computeContentHash("REPORT_CARD", "doc1", { note: 15, mention: "B" });
        const b = computeContentHash("REPORT_CARD", "doc1", { mention: "B", note: 15 });
        expect(a).toBe(b);
        expect(a).toMatch(/^[a-f0-9]{64}$/);
    });
    it("change si le document change (détection d'altération)", () => {
        const a = computeContentHash("REPORT_CARD", "doc1", { note: 15 });
        const b = computeContentHash("REPORT_CARD", "doc1", { note: 16 });
        expect(a).not.toBe(b);
    });
    it("change si le docId ou le docType change", () => {
        const base = computeContentHash("REPORT_CARD", "doc1", { n: 1 });
        expect(computeContentHash("REPORT_CARD", "doc2", { n: 1 })).not.toBe(base);
        expect(computeContentHash("CERTIFICATE", "doc1", { n: 1 })).not.toBe(base);
    });
});

describe("hashIp", () => {
    it("hache de façon déterministe et ne renvoie jamais l'IP en clair", () => {
        const h = hashIp("192.168.1.1", "salt");
        expect(h).toMatch(/^[a-f0-9]{64}$/);
        expect(h).not.toContain("192.168");
        expect(hashIp("192.168.1.1", "salt")).toBe(h);
    });
    it("diffère selon l'IP", () => {
        expect(hashIp("10.0.0.1")).not.toBe(hashIp("10.0.0.2"));
    });
});

describe("canSignDocType", () => {
    it("réserve bulletins/certificats/contrats à la direction (NETWORK_ADMIN hérite)", () => {
        expect(canSignDocType("DIRECTOR", "REPORT_CARD")).toBe(true);
        expect(canSignDocType("SCHOOL_ADMIN", "CERTIFICATE")).toBe(true);
        expect(canSignDocType("NETWORK_ADMIN", "STAFF_CONTRACT")).toBe(true);
        expect(canSignDocType("TEACHER", "REPORT_CARD")).toBe(false);
        expect(canSignDocType("PARENT", "REPORT_CARD")).toBe(false);
    });
    it("réserve l'autorisation parentale au parent", () => {
        expect(canSignDocType("PARENT", "PARENT_AUTHORIZATION")).toBe(true);
        expect(canSignDocType("DIRECTOR", "PARENT_AUTHORIZATION")).toBe(false);
    });
});
