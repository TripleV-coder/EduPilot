/**
 * Codes de liaison parent-enfant.
 *
 * L'école émet un code à usage unique pour un élève ; le parent doit le saisir
 * pour rattacher l'élève à son compte. Le code est stocké haché (bcrypt) et ne
 * transite en clair qu'une seule fois (au moment de l'émission).
 */
import bcrypt from "bcryptjs";

/** Alphabet sans caractères ambigus (0/O, 1/I/L) pour la dictée orale. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

/** Durée de validité d'un code de liaison (14 jours). */
export const LINK_CODE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** Génère un code lisible (ex. "K7M2QPRX"). */
export function generateLinkCode(): string {
    const bytes = new Uint8Array(CODE_LENGTH);
    globalThis.crypto.getRandomValues(bytes);
    let out = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
        out += ALPHABET[bytes[i] % ALPHABET.length];
    }
    return out;
}

/** Normalise une saisie utilisateur (majuscules, sans espaces/tirets). */
export function normalizeLinkCode(input: string): string {
    return input.toUpperCase().replace(/[\s-]/g, "");
}

export function hashLinkCode(code: string): Promise<string> {
    return bcrypt.hash(normalizeLinkCode(code), 10);
}

export function verifyLinkCode(code: string, hash: string): Promise<boolean> {
    return bcrypt.compare(normalizeLinkCode(code), hash);
}

export function linkCodeExpiry(now: number = Date.now()): Date {
    return new Date(now + LINK_CODE_TTL_MS);
}
