import { describe, expect, it } from "vitest";
import { pulseAnswerSchema, pulseWeekOf, shortWeekLabel } from "@/lib/wellbeing/pulse";
import { appointmentCreateSchema, appointmentVariantFor } from "@/lib/wellbeing/appointments";

describe("pulseWeekOf — semaine du Bénin (UTC+1), numérotation ISO", () => {
    it("commence le lundi 00 h heure de Cotonou (dimanche 23 h UTC)", () => {
        // Dimanche 8 nov. 2026, 22 h 59 UTC = 23 h 59 à Cotonou : encore la semaine du 2 nov.
        expect(pulseWeekOf(new Date("2026-11-08T22:59:00Z")).weekStart.toISOString()).toBe("2026-11-01T23:00:00.000Z");
        // Dimanche 23 h UTC = lundi 0 h à Cotonou : nouvelle semaine
        const monday = pulseWeekOf(new Date("2026-11-08T23:00:00Z"));
        expect(monday.weekStart.toISOString()).toBe("2026-11-08T23:00:00.000Z");
        expect(monday.weekLabel).toBe("2026-S46");
    });

    it("suit l'année ISO aux bornes de l'année civile", () => {
        // Jeudi 1er janv. 2026 : semaine 1 de 2026
        expect(pulseWeekOf(new Date("2026-01-01T10:00:00Z")).weekLabel).toBe("2026-S01");
        // Vendredi 1er janv. 2027 : encore la semaine 53 de 2026
        expect(pulseWeekOf(new Date("2027-01-01T10:00:00Z")).weekLabel).toBe("2026-S53");
        // Lundi 29 déc. 2025 : semaine 1 de 2026 (contient le jeudi 1er janv.)
        expect(pulseWeekOf(new Date("2025-12-29T10:00:00Z")).weekLabel).toBe("2026-S01");
    });

    it("libellé court pour les graphiques", () => {
        expect(shortWeekLabel("2026-S05")).toBe("S5");
        expect(shortWeekLabel("2026-S46")).toBe("S46");
        // Anciennes semaines (« S3 ») inchangées
        expect(shortWeekLabel("S3")).toBe("S3");
    });

    it("réponse : note entière 0-10 et 4 oui/non obligatoires", () => {
        expect(pulseAnswerSchema.safeParse({ score: 7, safety: true, friend: true, adultListens: false, harassWitness: false }).success).toBe(true);
        expect(pulseAnswerSchema.safeParse({ score: 11, safety: true, friend: true, adultListens: false, harassWitness: false }).success).toBe(false);
        expect(pulseAnswerSchema.safeParse({ score: 6.5, safety: true, friend: true, adultListens: false, harassWitness: false }).success).toBe(false);
        expect(pulseAnswerSchema.safeParse({ score: 5, safety: true }).success).toBe(false);
    });
});

describe("rendez-vous de la cellule d'écoute", () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    it("refuse un rendez-vous passé ou à plus d'un an", () => {
        expect(appointmentCreateSchema.safeParse({ startAt: future, kind: "Suivi régulier" }).success).toBe(true);
        expect(appointmentCreateSchema.safeParse({ startAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), kind: "Suivi" }).success).toBe(false);
        expect(appointmentCreateSchema.safeParse({ startAt: new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString(), kind: "Suivi" }).success).toBe(false);
    });

    it("durée 10 à 180 minutes, 30 par défaut", () => {
        const parsed = appointmentCreateSchema.parse({ startAt: future, kind: "Suivi régulier" });
        expect(parsed.durationMinutes).toBe(30);
        expect(appointmentCreateSchema.safeParse({ startAt: future, kind: "Suivi", durationMinutes: 5 }).success).toBe(false);
        expect(appointmentCreateSchema.safeParse({ startAt: future, kind: "Suivi", durationMinutes: 240 }).success).toBe(false);
    });

    it("ton déduit du type, l'urgence prime", () => {
        expect(appointmentVariantFor("Première écoute", false)).toBe("warning");
        expect(appointmentVariantFor("Entretien parents", false)).toBe("info");
        expect(appointmentVariantFor("Atelier collectif", false)).toBe("success");
        expect(appointmentVariantFor("Suivi régulier", false)).toBe("brand");
        expect(appointmentVariantFor("Suivi régulier", true)).toBe("danger");
    });
});
