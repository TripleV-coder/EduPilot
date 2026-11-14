/**
 * Réglages des services de messagerie de la plateforme (e-mail, SMS, appels
 * vocaux, WhatsApp) — modifiables dans la console root, plus besoin du
 * fichier .env ni d'un redéploiement (2026-11-08 ; e-mail le 2026-11-12).
 *
 * - Enregistrés dans `system_settings` (clé `integration:<NOM>`), les secrets
 *   chiffrés en AES-256-GCM (clé dérivée du secret maître, lib/auth/crypto).
 * - Lecture SYNCHRONE (les services l'utilisent tels quels) sur un instantané
 *   en mémoire : chargé au démarrage, relu toutes les 30 s par chaque
 *   processus, et aussitôt après un enregistrement sur le processus qui
 *   l'a reçu.
 * - Une variable d'environnement du même nom reste PRIORITAIRE (installations
 *   existantes inchangées) ; la console l'indique et ne la remplace pas.
 */
import { prismaBase } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/auth/crypto";
import { logger } from "@/lib/utils/logger";

/**
 * `kind` : contrôle de forme à l'enregistrement — https (adresse HTTPS),
 * smtp (smtp:// ou smtps://), email (adresse e-mail, avec ou sans nom
 * affiché « EduPilot <noreply@…> »), text (libre).
 */
export const INTEGRATION_SETTINGS = {
    EMAIL_API_KEY: { group: "email", label: "Clé d'API e-mail (Resend « re_… » ou SendGrid « SG.… »)", secret: true, kind: "text" },
    SMTP_URL: { group: "email", label: "Ou serveur SMTP (smtps://utilisateur:mot-de-passe@serveur)", secret: true, kind: "smtp" },
    EMAIL_FROM: { group: "email", label: "Adresse d'expédition (ex. EduPilot <noreply@ecole.bj>)", secret: false, kind: "email" },
    SMS_WEBHOOK_URL: { group: "sms", label: "Adresse de la passerelle SMS", secret: false, kind: "https" },
    SMS_API_KEY: { group: "sms", label: "Clé d'API SMS", secret: true, kind: "text" },
    VOICE_WEBHOOK_URL: { group: "voice", label: "Adresse de la passerelle vocale", secret: false, kind: "https" },
    VOICE_API_KEY: { group: "voice", label: "Clé d'API de la passerelle vocale", secret: true, kind: "text" },
    WHATSAPP_PHONE_ID: { group: "whatsapp", label: "Identifiant du numéro WhatsApp", secret: false, kind: "text" },
    WHATSAPP_ACCESS_TOKEN: { group: "whatsapp", label: "Jeton d'accès WhatsApp", secret: true, kind: "text" },
    WHATSAPP_APP_SECRET: { group: "whatsapp", label: "Clé secrète de l'application Meta (vérifie les statuts reçus)", secret: true, kind: "text" },
    WHATSAPP_TEMPLATE_NAME: { group: "whatsapp", label: "Modèle par défaut (annonces, messages libres)", secret: false, kind: "text" },
    WHATSAPP_TEMPLATE_ATTENDANCE: { group: "whatsapp", label: "Modèle « absence / retard » (sinon : modèle par défaut)", secret: false, kind: "text" },
    WHATSAPP_TEMPLATE_PAYMENT: { group: "whatsapp", label: "Modèle « paiement » (sinon : modèle par défaut)", secret: false, kind: "text" },
    WHATSAPP_TEMPLATE_GRADES: { group: "whatsapp", label: "Modèle « notes et bulletins » (sinon : modèle par défaut)", secret: false, kind: "text" },
    WHATSAPP_TEMPLATE_REMINDER: { group: "whatsapp", label: "Modèle « rappel / relance » (sinon : modèle par défaut)", secret: false, kind: "text" },
    WHATSAPP_TEMPLATE_LANG: { group: "whatsapp", label: "Langue du modèle (fr par défaut)", secret: false, kind: "text" },
    WHATSAPP_API_VERSION: { group: "whatsapp", label: "Version de l'API Meta (v21.0 par défaut)", secret: false, kind: "text" },
} as const;

const EMAIL_ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** Message d'erreur si la valeur n'a pas la forme attendue, sinon null. */
function checkKind(kind: (typeof INTEGRATION_SETTINGS)[IntegrationSettingName]["kind"], label: string, value: string): string | null {
    if (kind === "https" || kind === "smtp") {
        let url: URL;
        try {
            url = new URL(value);
        } catch {
            return `${label} : adresse invalide.`;
        }
        if (kind === "https" && url.protocol !== "https:") return `${label} : l'adresse doit commencer par https://.`;
        if (kind === "smtp" && url.protocol !== "smtp:" && url.protocol !== "smtps:") return `${label} : l'adresse doit commencer par smtps:// ou smtp://.`;
        if (kind === "smtp" && !url.hostname) return `${label} : serveur manquant.`;
    }
    if (kind === "email") {
        const address = value.match(/<([^>]+)>\s*$/)?.[1] ?? value;
        if (!EMAIL_ADDRESS.test(address.trim())) return `${label} : adresse e-mail invalide.`;
    }
    return null;
}

export type IntegrationSettingName = keyof typeof INTEGRATION_SETTINGS;
export const INTEGRATION_SETTING_NAMES = Object.keys(INTEGRATION_SETTINGS) as IntegrationSettingName[];

const KEY_PREFIX = "integration:";
export const INTEGRATION_REFRESH_MS = 30_000;

let snapshot = new Map<IntegrationSettingName, string>();
let refreshTimer: ReturnType<typeof setInterval> | null = null;

/** Valeur effective : variable d'environnement, sinon réglage de la console. */
export function getIntegrationSetting(name: IntegrationSettingName): string | undefined {
    const fromEnv = process.env[name]?.trim();
    if (fromEnv) return fromEnv;
    return snapshot.get(name) || undefined;
}

/** Relit les réglages en base (instantané remplacé d'un bloc). */
export async function loadIntegrationSettings(): Promise<void> {
    const rows = await prismaBase.systemSetting.findMany({
        where: { key: { startsWith: KEY_PREFIX } },
        select: { key: true, value: true, isSecret: true },
    });
    const next = new Map<IntegrationSettingName, string>();
    for (const row of rows) {
        const name = row.key.slice(KEY_PREFIX.length) as IntegrationSettingName;
        if (!(name in INTEGRATION_SETTINGS)) continue;
        const value = row.isSecret ? decryptSecret(row.value) : row.value;
        if (value === null) {
            logger.warn("Réglage d'intégration illisible (clé de chiffrement changée ?)", { module: "integration-settings", name });
            continue;
        }
        if (value) next.set(name, value);
    }
    snapshot = next;
}

/** Chargement au démarrage puis relecture périodique (une requête par processus toutes les 30 s). */
export async function startIntegrationSettingsRefresh(): Promise<void> {
    await loadIntegrationSettings().catch((error) =>
        logger.warn("Réglages d'intégration non chargés au démarrage", { module: "integration-settings", reason: (error as Error).message }),
    );
    if (refreshTimer) return;
    refreshTimer = setInterval(() => void loadIntegrationSettings().catch(() => {}), INTEGRATION_REFRESH_MS);
    refreshTimer.unref?.();
}

export type IntegrationSettingView = {
    name: IntegrationSettingName;
    group: string;
    label: string;
    secret: boolean;
    /** Origine de la valeur effective. */
    source: "env" | "console" | "unset";
    /** Valeur affichable : jamais un secret (seulement ses 4 derniers caractères). */
    display: string | null;
};

function display(value: string | undefined, secret: boolean): string | null {
    if (!value) return null;
    return secret ? `•••• ${value.slice(-4)}` : value;
}

/** Vue pour la console : valeurs non secrètes, secrets masqués, origine. */
export function integrationSettingsView(): IntegrationSettingView[] {
    return INTEGRATION_SETTING_NAMES.map((name) => {
        const meta = INTEGRATION_SETTINGS[name];
        const fromEnv = process.env[name]?.trim();
        const fromConsole = snapshot.get(name);
        return {
            name,
            group: meta.group,
            label: meta.label,
            secret: meta.secret,
            source: fromEnv ? "env" : fromConsole ? "console" : "unset",
            display: display(fromEnv || fromConsole, meta.secret),
        };
    });
}

/** Erreur de saisie (message affichable). */
export class IntegrationSettingError extends Error {}

/** Chiffrement impossible (secret maître absent) : rien n'est enregistré. */
export class IntegrationEncryptionUnavailableError extends Error {}

/**
 * Enregistre des réglages : chaîne = nouvelle valeur, chaîne vide ou null =
 * effacement ; un nom absent n'est pas modifié. Les adresses doivent être en
 * HTTPS. Le processus courant voit la nouvelle valeur immédiatement.
 */
export async function saveIntegrationSettings(changes: Partial<Record<IntegrationSettingName, string | null>>, updatedBy: string): Promise<void> {
    for (const [name, raw] of Object.entries(changes) as [IntegrationSettingName, string | null][]) {
        if (!(name in INTEGRATION_SETTINGS)) throw new IntegrationSettingError(`Réglage inconnu : ${name}`);
        const meta = INTEGRATION_SETTINGS[name];
        const value = raw?.trim() ?? "";
        if (value.length > 2000) throw new IntegrationSettingError(`${meta.label} : valeur trop longue.`);
        const invalid = value ? checkKind(meta.kind, meta.label, value) : null;
        if (invalid) throw new IntegrationSettingError(invalid);
    }
    // Secrets chiffrés AVANT toute écriture : sans clé, rien n'est enregistré
    const encrypted = new Map<IntegrationSettingName, string>();
    for (const [name, raw] of Object.entries(changes) as [IntegrationSettingName, string | null][]) {
        const value = raw?.trim() ?? "";
        if (!value || !INTEGRATION_SETTINGS[name].secret) continue;
        try {
            encrypted.set(name, encryptSecret(value));
        } catch {
            throw new IntegrationEncryptionUnavailableError("Chiffrement indisponible : le secret maître (NEXTAUTH_SECRET) du serveur est absent ou trop court.");
        }
    }
    await prismaBase.$transaction(async (tx) => {
        for (const [name, raw] of Object.entries(changes) as [IntegrationSettingName, string | null][]) {
            const meta = INTEGRATION_SETTINGS[name];
            const key = `${KEY_PREFIX}${name}`;
            const value = raw?.trim() ?? "";
            if (!value) {
                await tx.systemSetting.deleteMany({ where: { key } });
                continue;
            }
            const stored = meta.secret ? encrypted.get(name)! : value;
            await tx.systemSetting.upsert({
                where: { key },
                create: { key, value: stored, type: "string", isSecret: meta.secret, updatedBy },
                update: { value: stored, isSecret: meta.secret, updatedBy },
            });
        }
    });
    await loadIntegrationSettings();
}

/** Pour les tests. */
export function resetIntegrationSettingsForTests(): void {
    snapshot = new Map();
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
}
