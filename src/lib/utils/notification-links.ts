/**
 * Normalisation des liens de notification.
 *
 * Historiquement, les routes API écrivaient des liens relatifs hors du
 * groupe (dashboard) — `/messages/x`, `/student/grades`, `/appointments/x` —
 * alors que toutes les pages vivent sous `/dashboard/...`. Ce helper est
 * appliqué au rendu (NotificationCenter) pour couvrir aussi les anciennes
 * lignes déjà en base.
 */

/** Préfixes legacy → route réelle du dashboard. */
const LEGACY_PREFIXES: [RegExp, string][] = [
    [/^\/student\/grades/, "/dashboard/grades"],
    [/^\/student\/bulletins/, "/dashboard/report-cards"],
    [/^\/parent\/payments/, "/dashboard/finance"],
    [/^\/messages(\/.*)?$/, "/dashboard/messages"],
    [/^\/appointments(\/.*)?$/, "/dashboard/appointments"],
    [/^\/courses(\/[^/]+)?$/, "/dashboard/courses"],
    [/^\/compliance(\/.*)?$/, "/dashboard/compliance"],
];

export function normalizeNotificationLink(link: string | null | undefined): string | undefined {
    if (!link) return undefined;
    // Liens absolus (externes) et liens déjà corrects : inchangés
    if (link.startsWith("http") || link.startsWith("/dashboard")) return link;
    if (link === "/") return "/dashboard";

    for (const [pattern, target] of LEGACY_PREFIXES) {
        if (pattern.test(link)) return target;
    }

    // Lien interne inconnu : on le rebase sous /dashboard plutôt que de
    // laisser un 404 (les pages publiques ne sont jamais des cibles de notif)
    return link.startsWith("/") ? `/dashboard${link}` : `/dashboard/${link}`;
}
