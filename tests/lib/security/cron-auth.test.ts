import { describe, expect, it } from "vitest";
import { verifyCronSecret } from "@/lib/security/cron-auth";

/**
 * H2 / N2 — les crons s'authentifient par `Authorization: Bearer <CRON_SECRET>`.
 * La comparaison était un `===` (durée dépendante du contenu) ; elle passe par
 * une comparaison en temps constant.
 */
const SECRET = "c".repeat(64);

describe("verifyCronSecret", () => {
    it("accepte le secret exact", () => {
        expect(verifyCronSecret(`Bearer ${SECRET}`, SECRET)).toBe("ok");
    });

    it("refuse un secret erroné, préfixe ou suffixe compris", () => {
        expect(verifyCronSecret("Bearer mauvais", SECRET)).toBe("invalid");
        expect(verifyCronSecret(`Bearer ${SECRET.slice(0, -1)}`, SECRET)).toBe("invalid");
        expect(verifyCronSecret(`Bearer ${SECRET}x`, SECRET)).toBe("invalid");
    });

    it("refuse un en-tête absent, vide ou sans schéma Bearer", () => {
        expect(verifyCronSecret(null, SECRET)).toBe("invalid");
        expect(verifyCronSecret("", SECRET)).toBe("invalid");
        expect(verifyCronSecret(SECRET, SECRET)).toBe("invalid");
        expect(verifyCronSecret("Bearer ", SECRET)).toBe("invalid");
    });

    it("signale l'absence de configuration plutôt que d'accepter", () => {
        expect(verifyCronSecret(`Bearer ${SECRET}`, undefined)).toBe("not-configured");
        expect(verifyCronSecret("Bearer ", "")).toBe("not-configured");
    });
});
