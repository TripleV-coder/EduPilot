/**
 * Redirections après authentification, limitées à l'application.
 *
 * `callbackUrl` arrive de la query string : sans contrôle, un lien piégé
 * (`/mfa-verify?callbackUrl=https://evil.example`) renvoyait la personne,
 * fraîchement authentifiée, vers un site tiers.
 */

/** Chemin interne sûr (`/…`), sinon le repli. Refuse `//hôte` et `/\hôte`. */
export function safeCallbackPath(value: string | null | undefined, fallback = "/dashboard"): string {
    if (!value || !value.startsWith("/")) return fallback;
    if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
    return value;
}

/**
 * Callback `redirect` de NextAuth : même origine que l'app, sinon le tableau
 * de bord. Compare les origines, pas les préfixes — `startsWith(baseUrl)`
 * laissait passer `https://app.example.evil.tld`.
 */
export function resolveAuthRedirect(url: string, baseUrl: string): string {
    const fallback = `${baseUrl}/dashboard`;
    if (url.startsWith("/")) return `${baseUrl}${safeCallbackPath(url)}`;
    try {
        return new URL(url).origin === new URL(baseUrl).origin ? url : fallback;
    } catch {
        return fallback;
    }
}
