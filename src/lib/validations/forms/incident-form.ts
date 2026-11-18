import * as z from "zod";
import { incidentCreateSchema } from "@/lib/validations/incident";

/**
 * Formulaire de déclaration d'incident (navigateur seulement : volontairement
 * hors du premier niveau de `src/lib/validations`, qui alimente l'OpenAPI).
 *
 * Le champ date-heure produit « 2026-09-25T10:40 » (heure locale, sans fuseau
 * ni secondes), que le schéma strict du serveur refuse. Valider ici cette
 * valeur brute bloquait TOUTE déclaration d'incident (« La date et l'heure sont
 * obligatoires » sur une date remplie — recette du 2026-10-25). Le formulaire
 * vérifie une date lisible ; l'envoi la convertit en ISO (toISOString) et le
 * serveur garde son contrôle strict (incidentCreateSchema).
 */
export const incidentFormSchema = incidentCreateSchema.extend({
    date: z
        .string()
        .min(1, "La date et l'heure sont obligatoires")
        .refine((value) => !Number.isNaN(Date.parse(value)), "Date et heure invalides"),
});

export type IncidentFormValues = z.infer<typeof incidentFormSchema>;
