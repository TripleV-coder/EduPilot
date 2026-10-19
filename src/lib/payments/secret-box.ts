import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Chiffrement des secrets des comptes marchands (S7, ADR-0011).
 *
 * AES-256-GCM, clé maîtresse dédiée (jamais celle du 2FA) :
 *   PAYMENT_SECRETS_KEY            64 caractères hexadécimaux (openssl rand -hex 32)
 *   PAYMENT_SECRETS_KEY_VERSION    numéro de la clé active (défaut 1)
 *   PAYMENT_SECRETS_PREVIOUS_KEYS  anciennes clés, encore lisibles pendant une
 *                                  rotation : "1:<hex>,2:<hex>"
 *
 * Chaque chiffré est lié à son contexte (école, compte, champ) par les données
 * associées de GCM : recopié dans la ligne d'une autre école ou d'un autre
 * compte, il ne se déchiffre pas. Format stocké :
 *   "v<version>:<iv hex>:<tag hex>:<chiffré hex>"
 *
 * Sans clé valide, rien n'est chiffré ni déchiffré : la configuration et les
 * paiements en ligne deviennent indisponibles, jamais stockés en clair.
 */
const ALGORITHM = "aes-256-gcm";

export class PaymentSecretsUnavailableError extends Error {
    constructor(message = "Clé de chiffrement des comptes marchands absente ou invalide (PAYMENT_SECRETS_KEY).") {
        super(message);
        this.name = "PaymentSecretsUnavailableError";
    }
}

export interface SecretContext {
    schoolId: string;
    accountId: string;
    field: "secretKey" | "webhookSecret";
}

const aad = (context: SecretContext) => Buffer.from(`edupilot:payment-account:${context.schoolId}:${context.accountId}:${context.field}`);

function parseKey(hex: string | undefined): Buffer | null {
    return hex && /^[0-9a-fA-F]{64}$/.test(hex) ? Buffer.from(hex, "hex") : null;
}

/** Clé active et trousseau complet (active + anciennes). */
function keyring(env: NodeJS.ProcessEnv = process.env): { activeVersion: number; keys: Map<number, Buffer> } | null {
    const active = parseKey(env.PAYMENT_SECRETS_KEY);
    const activeVersion = Number(env.PAYMENT_SECRETS_KEY_VERSION ?? "1");
    if (!active || !Number.isInteger(activeVersion) || activeVersion < 1) return null;
    const keys = new Map<number, Buffer>([[activeVersion, active]]);
    for (const entry of (env.PAYMENT_SECRETS_PREVIOUS_KEYS ?? "").split(",").map((e) => e.trim()).filter(Boolean)) {
        const [version, hex] = entry.split(":");
        const key = parseKey(hex);
        const v = Number(version);
        if (key && Number.isInteger(v) && v >= 1 && v !== activeVersion) keys.set(v, key);
    }
    return { activeVersion, keys };
}

/** La clé maîtresse est-elle utilisable ? (sinon : configuration et paiements en ligne indisponibles) */
export function arePaymentSecretsAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
    return keyring(env) !== null;
}

export function encryptPaymentSecret(plaintext: string, context: SecretContext, env: NodeJS.ProcessEnv = process.env): { ciphertext: string; version: number } {
    const ring = keyring(env);
    if (!ring) throw new PaymentSecretsUnavailableError();
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, ring.keys.get(ring.activeVersion)!, iv);
    cipher.setAAD(aad(context));
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return {
        ciphertext: `v${ring.activeVersion}:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted.toString("hex")}`,
        version: ring.activeVersion,
    };
}

/**
 * Déchiffre un secret. Lève PaymentSecretsUnavailableError si aucune clé n'est
 * utilisable ; renvoie null si le chiffré est invalide, falsifié, déplacé
 * (autre école ou autre compte) ou chiffré par une clé inconnue.
 */
export function decryptPaymentSecret(stored: string, context: SecretContext, env: NodeJS.ProcessEnv = process.env): string | null {
    const ring = keyring(env);
    if (!ring) throw new PaymentSecretsUnavailableError();
    const match = /^v(\d+):([0-9a-f]{24}):([0-9a-f]{32}):([0-9a-f]+)$/i.exec(stored);
    if (!match) return null;
    const key = ring.keys.get(Number(match[1]));
    if (!key) return null;
    try {
        const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(match[2], "hex"));
        decipher.setAAD(aad(context));
        decipher.setAuthTag(Buffer.from(match[3], "hex"));
        return Buffer.concat([decipher.update(Buffer.from(match[4], "hex")), decipher.final()]).toString("utf8");
    } catch {
        return null;
    }
}

/** 4 derniers caractères, seule partie affichable d'une clé. */
export function lastFour(secret: string): string {
    return secret.slice(-4);
}
