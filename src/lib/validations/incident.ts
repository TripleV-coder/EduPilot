import * as z from "zod";

export const incidentCreateSchema = z.object({
    studentId: z.string().min(1, "Veuillez sélectionner un élève").cuid("ID invalide"),
    incidentType: z.enum([
        "LATE", "ABSENCE_UNEXCUSED", "DISRESPECT", "DISRUPTION", "CHEATING",
        "BULLYING", "VIOLENCE", "VANDALISM", "THEFT", "SUBSTANCE",
        "INAPPROPRIATE_LANGUAGE", "DRESS_CODE", "TECHNOLOGY_MISUSE", "OTHER"
    ]),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
    date: z.string().datetime({ message: "La date et l'heure sont obligatoires" }),
    location: z.string().optional(),
    description: z.string().min(10, "La description doit contenir au moins 10 caractères"),
    actionTaken: z.string().optional(),
});

export type IncidentFormValues = z.infer<typeof incidentCreateSchema>;
