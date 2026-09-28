import { describe, expect, it } from "vitest";
import { isBlockedBySchoolSuspension } from "@/lib/auth/school-suspension";
import { getLoginErrorMessage } from "@/lib/auth/login-errors";

/**
 * Recette 2026-09-28 (13/10) : un établissement « Suspendu (Accès bloqué) » par la
 * plateforme restait pleinement accessible — seul `user.isActive` était contrôlé.
 */
describe("isBlockedBySchoolSuspension", () => {
    it("bloque un compte rattaché à un établissement suspendu", () => {
        expect(isBlockedBySchoolSuspension({ role: "SCHOOL_ADMIN", school: { isActive: false } })).toBe(true);
        expect(isBlockedBySchoolSuspension({ role: "PARENT", school: { isActive: false } })).toBe(true);
    });

    it("laisse passer un compte d'un établissement actif", () => {
        expect(isBlockedBySchoolSuspension({ role: "TEACHER", school: { isActive: true } })).toBe(false);
    });

    it("ne bloque jamais le super-administrateur (il doit pouvoir réactiver)", () => {
        expect(isBlockedBySchoolSuspension({ role: "SUPER_ADMIN", school: { isActive: false } })).toBe(false);
    });

    it("ne bloque pas un compte sans établissement", () => {
        expect(isBlockedBySchoolSuspension({ role: "NETWORK_ADMIN", school: null })).toBe(false);
        expect(isBlockedBySchoolSuspension({ role: "TEACHER" })).toBe(false);
    });
});

describe("message de connexion pour un établissement suspendu", () => {
    it("explique la suspension plutôt que d'accuser le mot de passe", () => {
        expect(getLoginErrorMessage("CredentialsSignin", "school_suspended")).toBe(
            "L'accès de votre établissement est suspendu. Contactez sa direction ou le support EduPilot."
        );
    });
});
