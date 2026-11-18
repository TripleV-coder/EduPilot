import { z } from "zod";

/** Types de rendez-vous proposés (saisie libre possible, 60 caractères au plus). */
export const APPOINTMENT_KIND_SUGGESTIONS = [
    "Première écoute",
    "Suivi régulier",
    "Entretien parents",
    "Atelier collectif",
    "Urgence",
] as const;

export const WELLBEING_DESK_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] as const;

const MAX_AHEAD_MS = 366 * 24 * 60 * 60 * 1000;
// Tolérance de saisie : un rendez-vous « maintenant » reste accepté quelques minutes.
const BACKDATE_TOLERANCE_MS = 10 * 60 * 1000;

export const appointmentCreateSchema = z
    .object({
        startAt: z.coerce.date({ message: "Date et heure du rendez-vous requises." }),
        durationMinutes: z.coerce.number().int().min(10, "10 minutes au moins.").max(180, "3 heures au plus.").default(30),
        kind: z.string().trim().min(2, "Précisez le type de rendez-vous.").max(60, "60 caractères au plus."),
        // Anonyme par défaut : un libellé (« Anonyme · 3ᵉ A ») plutôt qu'un nom.
        anonymousLabel: z.string().trim().max(80, "80 caractères au plus.").nullable().optional(),
        isUrgent: z.boolean().default(false),
    })
    .refine((value) => value.startAt.getTime() >= Date.now() - BACKDATE_TOLERANCE_MS, {
        message: "Le rendez-vous doit être planifié dans le futur.",
        path: ["startAt"],
    })
    .refine((value) => value.startAt.getTime() <= Date.now() + MAX_AHEAD_MS, {
        message: "Le rendez-vous est trop lointain (un an au plus).",
        path: ["startAt"],
    });

export type AppointmentVariant = "brand" | "info" | "warning" | "success" | "danger";

/** Ton d'affichage déduit du type (l'urgence prime). */
export function appointmentVariantFor(kind: string, isUrgent: boolean): AppointmentVariant {
    if (isUrgent) return "danger";
    const k = kind.toLowerCase();
    if (k.includes("première") || k.includes("premiere")) return "warning";
    if (k.includes("parent") || k.includes("famille")) return "info";
    if (k.includes("atelier") || k.includes("groupe")) return "success";
    return "brand";
}
