/**
 * Badges d'accès — génération et résolution du code scanné.
 */
import { nanoid } from "nanoid";

/** Préfixe du QR encodant le matricule (cf. page contrôle d'accès). */
const MATRICULE_QR_PREFIX = "EDUPILOT:STUDENT:";

/** Génère un code de badge unique (token opaque). */
export function makeBadgeCode(): string {
    return `BDG-${nanoid(16)}`;
}

/**
 * Extrait le matricule d'une valeur scannée. Accepte le QR matricule
 * (`EDUPILOT:STUDENT:<matricule>`) ou un matricule brut.
 */
export function parseScannedMatricule(scanned: string): string {
    const trimmed = scanned.trim();
    if (trimmed.startsWith(MATRICULE_QR_PREFIX)) {
        return trimmed.slice(MATRICULE_QR_PREFIX.length).trim();
    }
    return trimmed;
}

/** Vrai si la valeur scannée ressemble à un code de badge opaque. */
export function isBadgeCode(scanned: string): boolean {
    return scanned.trim().startsWith("BDG-");
}
