/**
 * Validation des variables d'environnement requises.
 * Appelé une seule fois au démarrage du serveur (dans layout.tsx racine ou instrumentation.ts).
 *
 * En production, toute variable manquante fait crasher l'app immédiatement
 * avec un message d'erreur explicite — plutôt que de découvrir le problème
 * silencieusement en prod.
 */

interface EnvVar {
    name: string;
    required: "always" | "production";
    description: string;
}

const ENV_VARS: EnvVar[] = [
    {
        name: "DATABASE_URL",
        required: "always",
        description: "URL de connexion PostgreSQL",
    },
    {
        name: "NEXTAUTH_SECRET",
        required: "always",
        description: "Secret de chiffrement des sessions JWT (openssl rand -base64 32)",
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
        description: "Fournisseur email (resend ou sendgrid) — requis pour la réinitialisation de mot de passe",
    },
    {
        name: "EMAIL_API_KEY",
        required: "production",
        description: "Clé API du fournisseur email",
    },
    {
        name: "EMAIL_FROM",
        required: "production",
        description: "Adresse email expéditeur (ex: noreply@edupilot.com)",
    },
    {
        name: "UPSTASH_REDIS_REST_URL",
        required: "production",
        description: "URL Upstash Redis pour le rate limiting distribué",
    },
    {
        name: "UPSTASH_REDIS_REST_TOKEN",
        required: "production",
        description: "Token Upstash Redis pour le rate limiting distribué",
    },
];

/**
 * Valide les variables d'environnement requises.
 * - En développement : affiche des avertissements pour les variables manquantes.
 * - En production : lève une erreur bloquante si une variable requise est absente.
 */
export function validateEnv(): void {
    const isProd = process.env.NODE_ENV === "production";
    const warnings: string[] = [];
    const errors: string[] = [];

    for (const envVar of ENV_VARS) {
        const value = process.env[envVar.name];
        const isMissing = !value || value.trim() === "";

        // Vérifier les valeurs placeholder non remplacées
        const isPlaceholder =
            value?.includes("generate-") ||
            value?.includes("your-") ||
            value?.includes("xxxxx");

        if (isMissing || isPlaceholder) {
            const msg = `${envVar.name} — ${envVar.description}`;
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
 * Vérifie si le service email est configuré.
 * Retourne true si toutes les variables email sont présentes.
 */
export function isEmailConfigured(): boolean {
    return !!(
        process.env.EMAIL_PROVIDER &&
        process.env.EMAIL_API_KEY &&
        process.env.EMAIL_FROM
    );
}
