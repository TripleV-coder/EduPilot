/**
 * Plateforme d'exécution, déduite des variables que l'HÉBERGEUR pose lui-même
 * (jamais à renseigner dans le .env).
 *
 * « Sans serveur » (Vercel, Netlify, AWS Lambda) : plusieurs instances
 * éphémères, figées entre deux requêtes, sans disque persistant ni processus
 * permanent. L'application adapte alors son stockage (fichiers, compteurs en
 * base), son traitement des tâches (après la réponse) et la lecture de
 * l'adresse IP (en-tête posé par la plateforme).
 */
type Env = Record<string, string | undefined>;

export function isServerlessPlatform(env: Env = process.env): boolean {
    return env.VERCEL === "1" || Boolean(env.NETLIFY) || Boolean(env.AWS_LAMBDA_FUNCTION_NAME);
}

export function isVercel(env: Env = process.env): boolean {
    return env.VERCEL === "1";
}

/**
 * Adresse publique de l'application : NEXTAUTH_URL, puis NEXT_PUBLIC_APP_URL,
 * puis le domaine de production fourni par Vercel ; null si rien n'est connu.
 */
export function publicBaseUrl(env: Env = process.env): string | null {
    const explicit = env.NEXTAUTH_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim();
    if (explicit) return explicit.replace(/\/+$/, "");
    const vercelHost = env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || env.VERCEL_URL?.trim();
    return vercelHost ? `https://${vercelHost}` : null;
}
