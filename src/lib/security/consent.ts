/**
 * Consentement (Lot 6) — décisions du propriétaire du 2026-09-14.
 *
 * - Les conditions d'utilisation et la politique de confidentialité sont
 *   acceptées à la première connexion, avec la date et la **version** acceptée.
 *   Une nouvelle version est redemandée.
 * - Pour un élève mineur, le consentement est donné **par enfant**, par un
 *   parent rattaché. Un refus ou un retrait d'un seul parent suffit à retirer
 *   le consentement, et l'élève ne consent jamais seul à sa place.
 *
 * Tout est enregistré dans `DataConsent` : qui a répondu (`userId`), pour qui
 * (`subjectUserId`), quoi (`consentType`), quelle version, quand
 * (`grantedAt` / `revokedAt`).
 */
import prisma from "@/lib/prisma";
import { CONSENT_CHILD_DATA, CONSENT_TERMS, LEGAL_TERMS_VERSION } from "@/lib/security/consent-defaults";

export { CONSENT_CHILD_DATA, CONSENT_TERMS, LEGAL_TERMS_VERSION };

export interface PendingChildConsent {
    /** Identifiant du profil élève (ce que l'écran renvoie). */
    studentId: string;
    /** Identifiant du compte de l'élève (ce qui est enregistré comme sujet). */
    userId: string;
    firstName: string;
    lastName: string;
    /** `null` : ce parent n'a pas encore répondu pour cet enfant. */
    granted: boolean | null;
}

export interface PendingConsent {
    needsTerms: boolean;
    termsVersion: string;
    acceptedVersion: string | null;
    children: PendingChildConsent[];
}

/** Enfants rattachés à un compte parent, avec la réponse déjà donnée. */
async function childrenOf(userId: string): Promise<PendingChildConsent[]> {
    const parent = await prisma.parentProfile.findUnique({
        where: { userId },
        select: {
            parentStudents: {
                select: {
                    student: {
                        select: { id: true, userId: true, user: { select: { firstName: true, lastName: true } } },
                    },
                },
            },
        },
    });
    if (!parent) return [];

    const students = parent.parentStudents.map((link) => link.student);
    if (students.length === 0) return [];

    const answers = await prisma.dataConsent.findMany({
        where: { userId, consentType: CONSENT_CHILD_DATA, subjectUserId: { in: students.map((s) => s.userId) } },
        select: { subjectUserId: true, isGranted: true },
    });
    const byStudent = new Map(answers.map((a) => [a.subjectUserId, a.isGranted]));

    return students.map((s) => ({
        studentId: s.id,
        userId: s.userId,
        firstName: s.user.firstName,
        lastName: s.user.lastName,
        granted: byStudent.has(s.userId) ? byStudent.get(s.userId)! : null,
    }));
}

/** Ce qui reste à accepter pour ce compte. */
export async function getPendingConsent(userId: string): Promise<PendingConsent> {
    const terms = await prisma.dataConsent.findUnique({
        where: { userId_consentType_subjectUserId: { userId, consentType: CONSENT_TERMS, subjectUserId: userId } },
        select: { isGranted: true, version: true },
    });

    return {
        needsTerms: !terms?.isGranted || terms.version !== LEGAL_TERMS_VERSION,
        termsVersion: LEGAL_TERMS_VERSION,
        acceptedVersion: terms?.version ?? null,
        children: await childrenOf(userId),
    };
}

/** Écrit une réponse (accord ou refus) et horodate la révocation le cas échéant. */
export async function recordConsent(input: {
    userId: string;
    consentType: string;
    subjectUserId: string;
    isGranted: boolean;
    version?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
}): Promise<void> {
    const now = new Date();
    const data = {
        isGranted: input.isGranted,
        version: input.version ?? null,
        grantedAt: input.isGranted ? now : null,
        revokedAt: input.isGranted ? null : now,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
    };

    await prisma.dataConsent.upsert({
        where: {
            userId_consentType_subjectUserId: {
                userId: input.userId,
                consentType: input.consentType,
                subjectUserId: input.subjectUserId,
            },
        },
        create: {
            userId: input.userId,
            consentType: input.consentType,
            subjectUserId: input.subjectUserId,
            ...data,
        },
        update: data,
    });
}

/**
 * Les données de cet élève sont-elles couvertes par un consentement parental ?
 *
 * Vrai si au moins un parent rattaché a donné son accord **et** qu'aucun n'a
 * refusé ou retiré le sien. Un élève qui accepte pour lui-même ne compte pas :
 * seul un parent répond pour un enfant.
 */
export async function isStudentDataAllowed(studentUserId: string): Promise<boolean> {
    const answers = await prisma.dataConsent.findMany({
        where: { consentType: CONSENT_CHILD_DATA, subjectUserId: studentUserId },
        select: { isGranted: true, userId: true },
    });
    if (answers.length === 0) return false;
    if (answers.some((a) => !a.isGranted)) return false;
    return answers.some((a) => a.isGranted);
}
