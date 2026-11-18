/**
 * Chiffrement/déchiffrement AES-256-GCM pour les secrets sensibles (TOTP, etc.)
 *
 * Clé : TOTP_ENCRYPTION_KEY (64 caractères hexadécimaux) si elle est définie,
 * sinon dérivée de NEXTAUTH_SECRET (lib/security/derived-secrets.ts).
 *
 * Format stocké en DB : "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { resolveSecret } from "@/lib/security/derived-secrets";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
    const hex = resolveSecret("totp-encryption");
    if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
        throw new Error(
            "Clé de chiffrement 2FA indisponible : définir NEXTAUTH_SECRET (32 caractères au moins) ou TOTP_ENCRYPTION_KEY (64 caractères hexadécimaux)"
        );
    }
    return Buffer.from(hex, "hex");
}

/**
 * Chiffre une chaîne avec AES-256-GCM.
 * Retourne "<iv>:<authTag>:<ciphertext>" encodé en hex.
 */
export function encryptSecret(plaintext: string): string {
    const key = getEncryptionKey();
    const iv = randomBytes(12); // 96 bits recommandés pour GCM
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Déchiffre une valeur produite par encryptSecret().
 * Retourne null si la valeur est invalide ou si la clé a changé.
 */
export function decryptSecret(stored: string): string | null {
    try {
        const parts = stored.split(":");
        if (parts.length !== 3) return null;

        const [ivHex, authTagHex, ciphertextHex] = parts;
        const key = getEncryptionKey();
        const iv = Buffer.from(ivHex, "hex");
        const authTag = Buffer.from(authTagHex, "hex");
        const ciphertext = Buffer.from(ciphertextHex, "hex");

        const decipher = createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
    } catch {
        return null;
    }
}

/**
 * Détecte si une valeur est déjà chiffrée (format iv:authTag:ciphertext).
 * Utile pour la migration de données existantes en clair.
 */
export function isEncrypted(value: string): boolean {
    const parts = value.split(":");
    return parts.length === 3 && parts.every((p) => /^[0-9a-f]+$/i.test(p));
}
