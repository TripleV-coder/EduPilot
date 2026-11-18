import { describe, expect, it } from "vitest";
import { incidentCreateSchema } from "@/lib/validations/incident";
import { incidentFormSchema } from "@/lib/validations/forms/incident-form";

/**
 * Recette sur base vierge (2026-10-25) : le formulaire validait la valeur du
 * champ date-heure (« 2026-09-25T10:40 ») avec le schéma strict du serveur et
 * refusait TOUTE déclaration d'incident. Le serveur garde le contrôle strict.
 */
const base = {
    studentId: "ckabcdefghijklmnopqrstuvw",
    incidentType: "DISRUPTION" as const,
    severity: "MEDIUM" as const,
    description: "Bavardages répétés pendant le cours de français.",
};

describe("Déclaration d'incident : date-heure", () => {
    it("formulaire : accepte la valeur du champ date-heure (heure locale, sans fuseau)", () => {
        expect(incidentFormSchema.safeParse({ ...base, date: "2026-09-25T10:40" }).success).toBe(true);
    });

    it("formulaire : refuse une date vide ou illisible", () => {
        expect(incidentFormSchema.safeParse({ ...base, date: "" }).success).toBe(false);
        expect(incidentFormSchema.safeParse({ ...base, date: "pas une date" }).success).toBe(false);
    });

    it("serveur : contrôle strict inchangé (ISO avec fuseau), y compris la valeur convertie à l'envoi", () => {
        expect(incidentCreateSchema.safeParse({ ...base, date: "2026-09-25T10:40" }).success).toBe(false);
        expect(incidentCreateSchema.safeParse({ ...base, date: new Date("2026-09-25T10:40").toISOString() }).success).toBe(true);
    });
});
