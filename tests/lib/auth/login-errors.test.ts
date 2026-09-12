import { describe, expect, it } from "vitest";
import { getLoginErrorMessage } from "@/lib/auth/login-errors";

/**
 * H4 / M10 — le message affiché doit correspondre à la cause réelle :
 *  - trop de tentatives : l'utilisateur doit attendre, pas réessayer ;
 *  - panne technique : ce n'est pas son mot de passe (le support doit le savoir) ;
 *  - code 2FA faux : ce n'est pas son mot de passe non plus.
 */
describe("getLoginErrorMessage", () => {
    it("annonce un blocage temporaire après trop de tentatives", () => {
        expect(getLoginErrorMessage("RateLimited")).toBe(
            "Trop de tentatives de connexion. Réessayez dans quelques minutes."
        );
    });

    it("distingue une panne technique d'identifiants invalides (M10)", () => {
        expect(getLoginErrorMessage("CredentialsSignin", "service_unavailable")).toBe(
            "Service momentanément indisponible. Vos identifiants ne sont pas en cause : réessayez dans quelques instants."
        );
    });

    it("signale un code de vérification incorrect", () => {
        expect(getLoginErrorMessage("CredentialsSignin", "invalid_2fa")).toBe(
            "Code de vérification incorrect."
        );
    });

    it("garde le message d'identifiants invalides pour un échec d'authentification", () => {
        expect(getLoginErrorMessage("CredentialsSignin", "credentials")).toBe("Email ou mot de passe incorrect");
        expect(getLoginErrorMessage("CredentialsSignin")).toBe("Email ou mot de passe incorrect");
    });

    it("garde le message d'identifiants invalides pour une erreur inconnue", () => {
        expect(getLoginErrorMessage("Autre")).toBe("Email ou mot de passe incorrect");
    });
});
