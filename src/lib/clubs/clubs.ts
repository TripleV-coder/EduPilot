/**
 * Clubs et activités d'un établissement : validation et règles d'accès partagées
 * par les routes /api/clubs.
 */
import { z } from "zod";
import { roleSatisfies } from "@/lib/rbac/permissions";

export const CLUB_MANAGER_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] as const;

export function canManageClubs(role: string | undefined): boolean {
    return Boolean(role) && roleSatisfies(role as string, [...CLUB_MANAGER_ROLES]);
}

export const clubInputSchema = z.object({
    name: z.string().trim().min(2, "Nom du club trop court").max(80),
    category: z.string().trim().min(2, "Catégorie obligatoire").max(40),
    description: z.string().trim().max(500).optional().nullable(),
    schedule: z.string().trim().max(80).optional().nullable(),
    supervisorId: z.string().min(1).optional().nullable(),
    capacity: z.number().int().min(1).max(500).optional().nullable(),
});

export type ClubInput = z.infer<typeof clubInputSchema>;
