import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "next-auth";

vi.mock("@/lib/prisma", () => ({ default: { school: { findUnique: vi.fn() } } }));
vi.mock("@/lib/security/audit-log", () => ({ createAuditLog: vi.fn() }));

import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/security/audit-log";
import { FINANCE_SCOPE_AUDIT_ACTION, resolveFinanceSchool, superAdminTargetOutOfScope } from "@/lib/finance/finance-scope";

/** S6 : choix et contrôle de l'école d'une opération financière. */
const session = (role: string, schoolId: string | null, accessible: string[] = schoolId ? [schoolId] : []) =>
    ({ user: { id: "u1", role, schoolId, accessibleSchoolIds: accessible } }) as unknown as Session;
const schoolFind = vi.mocked(prisma.school.findUnique);
const body = async (r: { ok: false; response: Response } | { ok: true }) => ("response" in r ? r.response.json() : null);

beforeEach(() => {
    vi.clearAllMocks();
    schoolFind.mockImplementation((async ({ where }: { where: { id: string } }) => (where.id.startsWith("known") ? { id: where.id } : null)) as never);
});

describe("resolveFinanceSchool — super-admin", () => {
    it("sans école active ni demandée : 400 SCHOOL_REQUIRED, rien lu, rien journalisé", async () => {
        const r = await resolveFinanceSchool(session("SUPER_ADMIN", null), null, "t");
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.response.status).toBe(400);
        expect(await body(r)).toMatchObject({ code: "SCHOOL_REQUIRED" });
        expect(schoolFind).not.toHaveBeenCalled();
        expect(createAuditLog).not.toHaveBeenCalled();
    });

    it("école active existante : accordé et journalisé (école, opération, résultat)", async () => {
        const r = await resolveFinanceSchool(session("SUPER_ADMIN", "known-a"), null, "payments:list");
        expect(r).toEqual({ ok: true, schoolId: "known-a" });
        expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
            action: FINANCE_SCOPE_AUDIT_ACTION, schoolId: "known-a",
            newValues: { operation: "payments:list", outcome: "GRANTED" },
        }));
    });

    it("école demandée explicitement sans école active : vérifiée puis accordée", async () => {
        expect(await resolveFinanceSchool(session("SUPER_ADMIN", null), " known-b ", "t")).toEqual({ ok: true, schoolId: "known-b" });
    });

    it("école inexistante ou identifiant malformé : 404, refus journalisé sans école", async () => {
        for (const id of ["unknown", "x'; drop", "a".repeat(80)]) {
            const r = await resolveFinanceSchool(session("SUPER_ADMIN", null), id, "t");
            expect(r.ok).toBe(false);
            if (!r.ok) expect(r.response.status).toBe(404);
        }
        expect(schoolFind).toHaveBeenCalledTimes(1); // seul « unknown » est plausible
        expect(createAuditLog).toHaveBeenLastCalledWith(expect.objectContaining({
            schoolId: null, newValues: { operation: "t", outcome: "DENIED", reason: "SCHOOL_NOT_FOUND" }, severity: "WARNING",
        }));
    });

    it("école demandée différente de l'école active : 403 SCHOOL_MISMATCH", async () => {
        const r = await resolveFinanceSchool(session("SUPER_ADMIN", "known-a"), "known-b", "t");
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.response.status).toBe(403);
        expect(await body(r)).toMatchObject({ code: "SCHOOL_MISMATCH" });
        expect(schoolFind).not.toHaveBeenCalled();
    });
});

describe("resolveFinanceSchool — autres rôles (périmètre inchangé, pas de journal)", () => {
    it("école active par défaut, école accessible demandée acceptée", async () => {
        expect(await resolveFinanceSchool(session("ACCOUNTANT", "a", ["a", "b"]), null, "t")).toEqual({ ok: true, schoolId: "a" });
        expect(await resolveFinanceSchool(session("ACCOUNTANT", "a", ["a", "b"]), "b", "t")).toEqual({ ok: true, schoolId: "b" });
        expect(createAuditLog).not.toHaveBeenCalled();
    });

    it("école hors périmètre : 403 ; compte sans école : 403", async () => {
        const out = await resolveFinanceSchool(session("ACCOUNTANT", "a"), "b", "t");
        expect(await body(out)).toMatchObject({ code: "SCHOOL_FORBIDDEN" });
        const orphan = await resolveFinanceSchool(session("ACCOUNTANT", null), null, "t");
        expect(await body(orphan)).toMatchObject({ code: "NO_SCHOOL" });
    });
});

describe("superAdminTargetOutOfScope", () => {
    it("autres rôles : jamais concernés", async () => {
        expect(await superAdminTargetOutOfScope(session("ACCOUNTANT", "a"), "b", "t")).toBeNull();
    });

    it("super-admin : élément de l'école sélectionnée accepté, d'une autre refusé (403)", async () => {
        expect(await superAdminTargetOutOfScope(session("SUPER_ADMIN", "known-a"), "known-a", "t")).toBeNull();
        const refused = await superAdminTargetOutOfScope(session("SUPER_ADMIN", "known-a"), "known-b", "t");
        expect(refused?.status).toBe(403);
        expect(createAuditLog).toHaveBeenLastCalledWith(expect.objectContaining({
            newValues: { operation: "t", outcome: "DENIED", reason: "TARGET_OTHER_SCHOOL" },
        }));
    });

    it("super-admin sans école sélectionnée : 400", async () => {
        expect((await superAdminTargetOutOfScope(session("SUPER_ADMIN", null), "known-a", "t"))?.status).toBe(400);
    });
});
