import { describe, expect, it } from "vitest";
import { getLoginErrorMessage } from "@/lib/auth/login-errors";

/**
 * H4 — un refus pour trop de tentatives ne doit pas être présenté comme un
 * mot de passe erroné : l'utilisateur réessaierait et prolongerait le blocage.
 */
describe("getLoginErrorMessage", () => {
    it("annonce un blocage temporaire après trop de tentatives", () => {
        expect(getLoginErrorMessage("RateLimited")).toBe(
            "Trop de tentatives de connexion. Réessayez dans quelques minutes."
        );
    });

    it("garde le message d'identifiants invalides pour un échec d'authentification", () => {
        expect(getLoginErrorMessage("CredentialsSignin")).toBe("Email ou mot de passe incorrect");
    });

    it("garde le message d'identifiants invalides pour une erreur inconnue", () => {
        expect(getLoginErrorMessage("Autre")).toBe("Email ou mot de passe incorrect");
    });
});
