// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const session = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: session.current, status: "authenticated" }) }));

import { useRBAC } from "@/lib/hooks/use-rbac";

const asUser = (role: string, roles: string[]) => {
    session.current = { user: { id: "u", role, roles } };
    return renderHook(() => useRBAC()).result.current;
};

/**
 * Audit de clôture 2026-10-25 : les gardes de page lisaient roles[] alors que
 * l'API ne retient que le rôle principal — un STAFF + TEACHER ouvrait la
 * saisie de notes, puis chaque enregistrement était refusé (403).
 */
describe("useRBAC — rôle principal seulement, comme createApiHandler", () => {
    it("STAFF principal + TEACHER secondaire : page enseignant refusée", () => {
        const rbac = asUser("STAFF", ["STAFF", "TEACHER"]);
        expect(rbac.canAccess({ roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] })).toBe(false);
        expect(rbac.hasRole("TEACHER")).toBe(false);
    });

    it("TEACHER principal : page enseignant admise", () => {
        const rbac = asUser("TEACHER", ["TEACHER", "STAFF"]);
        expect(rbac.canAccess({ roles: ["TEACHER"] })).toBe(true);
        expect(rbac.hasRole("TEACHER")).toBe(true);
    });

    it("SUPER_ADMIN secondaire ne donne pas tout ; NETWORK_ADMIN hérite de SCHOOL_ADMIN", () => {
        expect(asUser("TEACHER", ["TEACHER", "SUPER_ADMIN"]).canAccess({ roles: ["SCHOOL_ADMIN"] })).toBe(false);
        expect(asUser("NETWORK_ADMIN", []).canAccess({ roles: ["SCHOOL_ADMIN"] })).toBe(true);
    });
});
