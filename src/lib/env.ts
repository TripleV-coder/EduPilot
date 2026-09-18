/**
 * Environnement — module unique (L3, décision du propriétaire du 2026-09-18).
 *
 * Remplace `lib/config/env.ts` et `lib/config/env-validation.ts`, qui
 * portaient deux validations aux règles divergentes (piège N5 : l'une
 * respectait SKIP_ENV_VALIDATION, l'autre non).
 *
 * Deux portées, volontairement distinctes :
 *  - `validateCriticalEnv()` : base et secret de session seulement. Exécutée à
 *    l'import de Prisma, donc aussi pendant `next build` et dans les scripts.
 *  - `validateEnv()` : jeu complet, exécutée une fois au démarrage du serveur
 *    (`instrumentation.ts`). En production, toute variable manquante empêche
 *    le démarrage, plutôt que d'être découverte en service.
 */

interface EnvVar {
    name: string;
    required: "always" | "production";
    description: string;
    /** Exigée seulement si cette condition est vraie (ex. selon le fournisseur d'email). */
    when?: () => boolean;
    /** Contrôle de forme, appliqué quand la variable est présente. */
    check?: (value: string) => string | null;
}

const EXAMPLE_SECRET = "generate-a-secure-secret-with-openssl-rand-base64-32";
const MIN_SECRET_LENGTH = 32;

function checkSessionSecret(value: string): string | null {
    if (value === EXAMPLE_SECRET) return "valeur d'exemple non remplacée";
    if (value.length < MIN_SECRET_LENGTH) {
        return `secret trop court (${value.length} caractères, minimum ${MIN_SECRET_LENGTH})`;
    }
    return null;
}

function checkDatabaseUrl(value: string): string | null {
    if (!value.startsWith("postgresql://") && !value.startsWith("postgres://")) {
        return "format attendu postgresql://utilisateur:motdepasse@hôte:port/base";
    }
    return null;
}

const usesSmtp = () => process.env.EMAIL_PROVIDER === "smtp";

const ENV_VARS: EnvVar[] = [
    {
        name: "DATABASE_URL",
        required: "always",
        description: "URL de connexion PostgreSQL",
        check: checkDatabaseUrl,
    },
    {
        name: "NEXTAUTH_SECRET",
        required: "always",
        description: "Secret de chiffrement des sessions JWT (openssl rand -base64 32)",
        check: checkSessionSecret,
    },
    {
        name: "NEXTAUTH_URL",
        required: "production",
        description: "URL publique de l'application (ex: https://app.edupilot.com)",
    },
    {
        name: "TOTP_ENCRYPTION_KEY",
        required: "production",
        description: "Clé AES-256 pour chiffrer les secrets TOTP (openssl rand -hex 32)",
    },
    {
        name: "EMAIL_PROVIDER",
        required: "production",
        description: "Fournisseur email (smtp, resend ou sendgrid) — requis pour la réinitialisation de mot de passe",
    },
    {
        name: "EMAIL_API_KEY",
        required: "production",
        description: "Clé API du fournisseur email (resend / sendgrid)",
        when: () => !usesSmtp(),
    },
    {
        name: "SMTP_HOST",
        required: "production",
        description: "Serveur SMTP (EMAIL_PROVIDER=smtp)",
        when: usesSmtp,
    },
    {
        name: "EMAIL_FROM",
        required: "production",
        description: "Adresse email expéditeur (ex: noreply@edupilot.com)",
    },
    {
        name: "SIGNATURE_SALT",
        required: "production",
        description: "Sel du hachage des adresses IP des signatures électroniques (openssl rand -hex 32)",
    },
    {
        name: "EDUPILOT_PEER_TOKEN",
        required: "production",
        description:
            "Posé automatiquement par le préchargement de l'IP client : démarrer le serveur avec " +
            "`node --require ./scripts/server/client-ip-preload.cjs` (sans lui, le rate-limit ne peut pas identifier les clients)",
    },
    // Upstash n'est plus exigé (décision du 2026-09-12) : un seul processus,
    // rate-limit et cache en mémoire, aucune adresse IP envoyée hors machine.
];

/**
 * Valide les variables d'environnement requises.
 * - En développement : affiche des avertissements pour les variables manquantes.
 * - En production : lève une erreur bloquante si une variable requise est absente.
 */
export function validateEnv(): void {
    // E2E / CI smoke runs build with NODE_ENV=production but never hit the
    // real email / Redis paths under audit, so let SKIP_ENV_VALIDATION=true
    // bypass prod-required vars at runtime — same escape hatch already used
    // at build time. Should never be set in real production.
    if (process.env.SKIP_ENV_VALIDATION === "true") return;

    const isProd = process.env.NODE_ENV === "production";
    const warnings: string[] = [];
    const errors: string[] = [];

    for (const envVar of ENV_VARS) {
        if (envVar.when && !envVar.when()) continue;
        const value = process.env[envVar.name];
        const isMissing = !value || value.trim() === "";

        // Vérifier les valeurs placeholder non remplacées
        const isPlaceholder =
            value?.includes("generate-") ||
            value?.includes("your-") ||
            value?.includes("xxxxx");

        const malformed = !isMissing && envVar.check ? envVar.check(value) : null;

        if (isMissing || isPlaceholder || malformed) {
            const reason = malformed ? ` (${malformed})` : "";
            const msg = `${envVar.name} — ${envVar.description}${reason}`;
            if (envVar.required === "always" || isProd) {
                errors.push(msg);
            } else {
                warnings.push(msg);
            }
        }
    }

    // En développement : warnings seulement
    if (warnings.length > 0 && !isProd) {
        console.warn(
            "\n⚠️  [EduPilot] Variables d'environnement manquantes (warnings dev) :\n" +
                warnings.map((w) => `   • ${w}`).join("\n") +
                "\n"
        );
    }

    // En production OU variable "always" : erreur bloquante
    if (errors.length > 0) {
        const context = isProd ? "production" : "toujours requises";
        throw new Error(
            `\n❌ [EduPilot] Variables d'environnement requises (${context}) manquantes :\n` +
                errors.map((e) => `   • ${e}`).join("\n") +
                "\n\nConsultez .env.example pour la configuration complète.\n"
        );
    }
}

/**
 * Validation minimale, exécutée à l'import de Prisma — donc dans les scripts,
 * les tâches planifiées et pendant `next build`.
 *
 * N5 : les secrets ne servent pas à construire (l'étape de build du Dockerfile
 * n'en définit aucun) et sont vérifiés au démarrage par `validateEnv()`.
 * La phase de build et SKIP_ENV_VALIDATION sont donc ignorées ici aussi.
 */
export function validateCriticalEnv(): void {
    if (process.env.NODE_ENV === "test") return;
    if (
        process.env.NEXT_PHASE === "phase-production-build" ||
        process.env.SKIP_ENV_VALIDATION === "true"
    ) {
        return;
    }

    // Lectures littérales : l'inventaire `.env.example` ↔ code (M6) repose sur
    // la présence du nom dans la source (tests/lib/config/env-documentation).
    const critical = [
        { name: "DATABASE_URL", value: process.env.DATABASE_URL, check: checkDatabaseUrl },
        { name: "NEXTAUTH_SECRET", value: process.env.NEXTAUTH_SECRET, check: checkSessionSecret },
    ];

    const errors: string[] = [];

    for (const { name, value, check } of critical) {
        if (!value || value.trim() === "") {
            errors.push(`${name} — variable manquante`);
            continue;
        }
        const malformed = check(value);
        if (malformed) errors.push(`${name} — ${malformed}`);
    }

    if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_APP_URL) {
        console.warn(
            "⚠️  NEXT_PUBLIC_APP_URL non défini — http://localhost:3000 par défaut"
        );
    }

    if (errors.length > 0) {
        console.error(
            "\n❌ [EduPilot] Configuration invalide — démarrage impossible :\n" +
                errors.map((e) => `   • ${e}`).join("\n") +
                "\n\nConsultez .env.example pour référence.\n"
        );
        throw new Error("Critical environment variables missing or invalid. Check logs.");
    }
}

function getEnv(key: string): string | undefined {
    if (typeof process === "undefined") return undefined;
    return process.env[key];
}

const nodeEnv = getEnv("NODE_ENV") ?? "development";

/** Lecture typée des réglages consultés à chaud (ex-`lib/config/env.ts`). */
export const appEnv = {
    nodeEnv,
    isProduction: nodeEnv === "production",
    isTest: nodeEnv === "test",

    allowBackupApi: getEnv("ALLOW_BACKUP_API") === "true",
    allowBackupApiInProduction: getEnv("ALLOW_BACKUP_API_IN_PRODUCTION") === "true",

    ai: {
        enabled: getEnv("AI_ENABLED") !== "false",
        providers: (getEnv("AI_PROVIDER") ?? "")
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean),
        hasExternalKeys: Boolean(
            getEnv("GROQ_API_KEY") ||
                getEnv("OPENAI_API_KEY") ||
                getEnv("ANTHROPIC_API_KEY") ||
                getEnv("GOOGLE_AI_API_KEY")
        ),
    },
};
