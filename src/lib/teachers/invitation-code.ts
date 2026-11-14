/**
 * Codes d'invitation enseignant : un établissement remet un code à un
 * enseignant qui a DÉJÀ un compte EduPilot ; l'enseignant le saisit dans
 * « Mon compte » et l'établissement s'ajoute à ses écoles.
 *
 * Le code n'est associé à aucun identifiant saisi (contrairement au code
 * parent, retrouvé par matricule) : il est retrouvé par son EMPREINTE
 * (HMAC-SHA256 avec le secret du serveur), d'où une recherche directe par
 * index unique. Sécurité : 10 caractères parmi 31 (~49,5 bits), usage
 * unique, durée limitée, tentatives limitées par compte et par adresse.
 * Le code ne transite en clair qu'une fois, à l'émission.
 */
import { createHmac } from "node:crypto";

/** Alphabet sans caractères ambigus (0/O, 1/I/L), pour la dictée orale. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 10;

/** Validité d'un code d'invitation : 7 jours. */
export const TEACHER_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Code lisible, présenté en deux groupes : « K7M2Q-PRXA9 ». */
export function generateTeacherInvitationCode(): string {
    // Tirage par rejet : pas de biais modulo (256 n'est pas multiple de 31)
    const limit = 256 - (256 % ALPHABET.length);
    let out = "";
    while (out.length < CODE_LENGTH) {
        const bytes = new Uint8Array(CODE_LENGTH * 2);
        globalThis.crypto.getRandomValues(bytes);
        for (const byte of bytes) {
            if (byte < limit && out.length < CODE_LENGTH) out += ALPHABET[byte % ALPHABET.length];
        }
    }
    return `${out.slice(0, 5)}-${out.slice(5)}`;
}

/** Saisie normalisée : majuscules, sans espaces ni tirets. */
export function normalizeTeacherInvitationCode(input: string): string {
    return input.toUpperCase().replace(/[\s-]/g, "");
}

/** Format attendu après normalisation (évite tout calcul sur une saisie absurde). */
export function isWellFormedTeacherInvitationCode(input: string): boolean {
    const code = normalizeTeacherInvitationCode(input);
    return code.length === CODE_LENGTH && [...code].every((c) => ALPHABET.includes(c));
}

function pepper(): string {
    const secret = process.env.NEXTAUTH_SECRET;
    if (secret) return secret;
    if (process.env.NODE_ENV === "production") throw new Error("NEXTAUTH_SECRET manquant");
    return "edupilot-developpement-uniquement";
}

/** Empreinte stockée et recherchée (jamais le code lui-même). */
export function hashTeacherInvitationCode(code: string): string {
    return createHmac("sha256", pepper()).update(`teacher-invitation:${normalizeTeacherInvitationCode(code)}`).digest("hex");
}

export function teacherInvitationExpiry(now: number = Date.now()): Date {
    return new Date(now + TEACHER_INVITATION_TTL_MS);
}
