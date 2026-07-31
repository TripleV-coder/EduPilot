/**
 * Carte scolaire imprimable — assemblage des données et choix du payload QR.
 *
 * Le QR encode en priorité le code de badge opaque (révocable via l'access-control) ;
 * à défaut de badge valide, il retombe sur le QR matricule reconnu par le scanner.
 * Aucune donnée sensible n'est encodée dans le QR.
 */
import { makeMatriculeQr } from "@/lib/access-control/badge";

export interface BadgeLike {
    code: string;
    revokedAt: Date | null;
    validUntil: Date | null;
}

/** Vrai si le badge est exploitable (non révoqué et non expiré). */
function isBadgeUsable(badge: BadgeLike, now: Date): boolean {
    if (badge.revokedAt) return false;
    if (badge.validUntil && badge.validUntil.getTime() <= now.getTime()) return false;
    return true;
}

/**
 * Détermine la valeur à encoder dans le QR de la carte :
 * le code de badge si valide, sinon le QR matricule en repli.
 */
export function resolveCardQrPayload(
    badge: BadgeLike | null | undefined,
    matricule: string,
    now: Date = new Date(),
): string {
    if (badge && isBadgeUsable(badge, now)) {
        return badge.code;
    }
    return makeMatriculeQr(matricule);
}

export interface StudentCardInput {
    student: {
        matricule: string;
        photoUrl: string | null;
        firstName: string;
        lastName: string;
        dateOfBirth: Date | null;
    };
    className: string | null;
    academicYearLabel: string | null;
    school: {
        name: string;
        logo: string | null;
        primaryColor: string | null;
    };
    badge: BadgeLike | null;
    now?: Date;
}

export interface StudentCardData {
    fullName: string;
    matricule: string;
    photoUrl: string | null;
    className: string;
    academicYearLabel: string;
    dateOfBirth: string | null;
    school: {
        name: string;
        logo: string | null;
        primaryColor: string;
    };
    qrPayload: string;
}

/** Assemble le DTO d'une carte scolaire à partir des entités de la base. */
export function buildStudentCardData(input: StudentCardInput): StudentCardData {
    const { student, className, academicYearLabel, school, badge, now = new Date() } = input;
    return {
        fullName: `${student.firstName} ${student.lastName}`.trim(),
        matricule: student.matricule,
        photoUrl: student.photoUrl,
        className: className?.trim() || "—",
        academicYearLabel: academicYearLabel?.trim() || "—",
        dateOfBirth: student.dateOfBirth ? student.dateOfBirth.toISOString() : null,
        school: {
            name: school.name,
            logo: school.logo,
            primaryColor: school.primaryColor?.trim() || "brand",
        },
        qrPayload: resolveCardQrPayload(badge, student.matricule, now),
    };
}
