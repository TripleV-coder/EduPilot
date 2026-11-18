import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import { dbContextForSession } from "@/lib/db/session-db-context";

function session(role: string, schoolId: string | null, accessibleSchoolIds: string[]): Session {
    return {
        user: { id: "u1", role, schoolId, accessibleSchoolIds },
        expires: new Date(Date.now() + 3_600_000).toISOString(),
    } as unknown as Session;
}

describe("dbContextForSession — établissements visibles en base (RLS)", () => {
    it("enseignant de deux écoles : seulement l'école active", () => {
        expect(dbContextForSession(session("TEACHER", "ecole-b", ["ecole-a", "ecole-b"]))).toEqual({
            kind: "tenant",
            schoolIds: ["ecole-b"],
        });
    });

    it("enseignant sans école active : ses écoles accessibles (aucune élargie)", () => {
        expect(dbContextForSession(session("TEACHER", null, ["ecole-a"]))).toEqual({ kind: "tenant", schoolIds: ["ecole-a"] });
    });

    it("parent : l'école active et celles de ses enfants (inchangé)", () => {
        expect(dbContextForSession(session("PARENT", "ecole-a", ["ecole-a", "ecole-b"]))).toEqual({
            kind: "tenant",
            schoolIds: ["ecole-a", "ecole-b"],
        });
    });

    it("super administrateur : contexte système ; pas de session : aucun contexte", () => {
        expect(dbContextForSession(session("SUPER_ADMIN", null, []))).toEqual({ kind: "system", reason: "super-admin" });
        expect(dbContextForSession(null)).toBeNull();
    });
});
