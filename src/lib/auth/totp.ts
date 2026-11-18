/**
 * Codes à usage unique basés sur le temps (TOTP, RFC 6238 sur HOTP, RFC 4226)
 * avec `node:crypto` seul — remplace le paquet `otplib` (2026-11-08).
 *
 * Paramètres des applications d'authentification courantes (Google
 * Authenticator, Microsoft Authenticator, Aegis…) : HMAC-SHA1, 6 chiffres,
 * période 30 s. Le secret est échangé en Base32 (RFC 4648), comme dans l'URI
 * `otpauth://` du QR code ; les secrets déjà enregistrés restent valides.
 * Vérifié contre les vecteurs de test officiels (RFC 6238, annexe B).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;

export function base32Encode(bytes: Uint8Array): string {
    let bits = 0;
    let value = 0;
    let out = "";
    for (const byte of bytes) {
        value = ((value << 8) | byte) & 0xffff;
        bits += 8;
        while (bits >= 5) {
            out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    return out;
}

/** Décode du Base32 ; tolère minuscules, espaces et `=` final. Lève une erreur sur un caractère invalide. */
export function base32Decode(input: string): Buffer {
    const clean = input.replace(/[\s=]/g, "").toUpperCase();
    let bits = 0;
    let value = 0;
    const out: number[] = [];
    for (const char of clean) {
        const index = BASE32_ALPHABET.indexOf(char);
        if (index === -1) throw new Error("Secret TOTP invalide (Base32 attendu)");
        value = ((value << 5) | index) & 0xffff;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(out);
}

/** Nouveau secret : 160 bits aléatoires (taille recommandée par la RFC 4226), en Base32. */
export function generateTotpSecret(): string {
    return base32Encode(randomBytes(20));
}

/** Code HOTP du compteur donné (troncature dynamique, RFC 4226 §5.3). */
export function hotp(key: Buffer, counter: number, digits = TOTP_DIGITS, algorithm: "sha1" | "sha256" | "sha512" = "sha1"): string {
    const message = Buffer.alloc(8);
    message.writeBigUInt64BE(BigInt(counter));
    const mac = createHmac(algorithm, key).update(message).digest();
    const offset = mac[mac.length - 1] & 0x0f;
    const binary = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
    return String(binary % 10 ** digits).padStart(digits, "0");
}

/** Code TOTP en vigueur à l'instant `nowMs` pour un secret Base32. */
export function totpCode(secret: string, nowMs = Date.now()): string {
    return hotp(base32Decode(secret), Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS));
}

/**
 * Vrai si `token` est le code de la période en cours ou d'une période
 * voisine (`window`, dérive d'horloge du téléphone). Comparaison à temps
 * constant ; un code mal formé est refusé sans calcul.
 */
export function verifyTotpCode(token: string, secret: string, options: { window?: number; nowMs?: number } = {}): boolean {
    const { window = 1, nowMs = Date.now() } = options;
    if (!/^\d{6}$/.test(token)) return false;
    const key = base32Decode(secret);
    if (key.length === 0) return false;
    const counter = Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS);
    const given = Buffer.from(token);
    let valid = false;
    for (let delta = -window; delta <= window; delta++) {
        // Toutes les périodes sont comparées (pas de sortie anticipée)
        if (timingSafeEqual(Buffer.from(hotp(key, counter + delta)), given)) valid = true;
    }
    return valid;
}
