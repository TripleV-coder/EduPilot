/**
 * Secrets techniques dérivés d'un seul secret maître (`NEXTAUTH_SECRET`).
 *
 * But : un `.env` minimal. Chaque usage reçoit sa propre clé, calculée par
 * HKDF-SHA256 (RFC 5869) à partir du secret maître et d'une étiquette
 * distincte : connaître une clé dérivée ne révèle ni le secret maître ni les
 * autres clés.
 *
 * Une variable explicite reste TOUJOURS prioritaire (installations existantes
 * inchangées) :
 *   TOTP_ENCRYPTION_KEY · SIGNATURE_SALT · PAYMENT_SECRETS_KEY · CRON_SECRET ·
 *   METRICS_TOKEN · INITIAL_SETUP_TOKEN (et la paire de clés push : push/config)
 *
 * ⚠️ Changer `NEXTAUTH_SECRET` change les clés dérivées : les secrets 2FA et
 * les clés des comptes marchands chiffrés en base deviendraient illisibles.
 * Avant une rotation, figer les valeurs actuelles en variables explicites :
 *   node scripts/secrets/print-derived.mjs   (voir docs/EXPLOITATION.md)
 */
import { hkdfSync } from "node:crypto";

type Env = Record<string, string | undefined>;

export type SecretPurpose = "totp-encryption" | "signature-salt" | "payment-secrets" | "cron" | "metrics" | "setup";

/** Variable explicite qui, si elle est définie, remplace la clé dérivée. */
export const SECRET_OVERRIDES: Record<SecretPurpose, string> = {
    "totp-encryption": "TOTP_ENCRYPTION_KEY",
    "signature-salt": "SIGNATURE_SALT",
    "payment-secrets": "PAYMENT_SECRETS_KEY",
    cron: "CRON_SECRET",
    metrics: "METRICS_TOKEN",
    setup: "INITIAL_SETUP_TOKEN",
};

const MIN_MASTER_LENGTH = 32;
const SALT = "edupilot:derived-secrets:v1";

/** Secret maître utilisable (même règle que la validation de démarrage : 32 caractères au moins). */
export function masterSecret(env: Env = process.env): string | null {
    const secret = (env.NEXTAUTH_SECRET ?? env.AUTH_SECRET)?.trim();
    return secret && secret.length >= MIN_MASTER_LENGTH ? secret : null;
}

/** Clé dérivée (32 octets, hexadécimal) pour un usage, ou null sans secret maître. */
export function derivedSecretHex(purpose: SecretPurpose, env: Env = process.env): string | null {
    const master = masterSecret(env);
    if (!master) return null;
    return Buffer.from(hkdfSync("sha256", master, SALT, `edupilot:${purpose}`, 32)).toString("hex");
}

/** Valeur effective : la variable explicite si elle est définie, sinon la clé dérivée. */
export function resolveSecret(purpose: SecretPurpose, env: Env = process.env): string | null {
    const explicit = env[SECRET_OVERRIDES[purpose]]?.trim();
    return explicit || derivedSecretHex(purpose, env);
}

/** D'où vient la valeur effective (pour la page de santé et les journaux, jamais la valeur). */
export function secretSource(purpose: SecretPurpose, env: Env = process.env): "explicit" | "derived" | "missing" {
    if (env[SECRET_OVERRIDES[purpose]]?.trim()) return "explicit";
    return masterSecret(env) ? "derived" : "missing";
}
