/**
 * Normalisation des liens de notification.
 *
 * Historiquement, les routes API écrivaient des liens relatifs hors du
 * groupe (dashboard) — `/messages/x`, `/appointments/x`, `/payments/plans/x` —
 * alors que toutes les pages vivent sous `/dashboard/...`. Les routes écrivent
 * désormais le bon lien ; ce helper est appliqué à la lecture
 * (`/api/notifications/feed`) pour couvrir les anciennes lignes déjà en base.
 *
 * Chaque cible est une page qui existe : quand le module n'a pas de page de
 * détail, le lien mène à la liste plutôt qu'à un 404.
 */

/** Routes `/dashboard` écrites par erreur, qui n'ont jamais existé. */
const DASHBOARD_ALIASES: [RegExp, string][] = [
    [/^\/dashboard\/report-cards(?:\/.*)?$/, "/dashboard/grades/bulletins"],
];

/** Préfixes legacy → route réelle du dashboard (`$1` = identifiant conservé). */
const LEGACY_PREFIXES: [RegExp, string][] = [
    [/^\/student\/grades/, "/dashboard/grades"],
    [/^\/student\/bulletins/, "/dashboard/grades/bulletins"],
    [/^\/(?:parent\/)?payments(?:\/.*)?$/, "/dashboard/finance"],
    [/^\/messages(?:\/.*)?$/, "/dashboard/messages"],
    [/^\/appointments(?:\/.*)?$/, "/dashboard/appointments"],
    [/^\/scholarships(?:\/.*)?$/, "/dashboard/scholarships"],
    [/^\/events(?:\/.*)?$/, "/dashboard/events"],
    [/^\/announcements(?:\/.*)?$/, "/dashboard/announcements"],
    [/^\/compliance(?:\/.*)?$/, "/dashboard/compliance"],
    [/^\/exams\/sessions(?:\/.*)?$/, "/dashboard/exams"],
    // Modules dotés d'une page de détail : l'identifiant est conservé
    [/^\/courses(\/[^/]+)?$/, "/dashboard/courses$1"],
    [/^\/homework(\/[^/]+)?$/, "/dashboard/homework$1"],
    [/^\/incidents(\/[^/]+)?$/, "/dashboard/incidents$1"],
];

export function normalizeNotificationLink(link: string | null | undefined): string | undefined {
    if (!link) return undefined;
    // Liens absolus (externes) et liens déjà corrects : inchangés
    if (link.startsWith("http")) return link;
    if (link.startsWith("/dashboard")) {
        for (const [pattern, target] of DASHBOARD_ALIASES) {
            if (pattern.test(link)) return target;
        }
        return link;
    }
    if (link === "/") return "/dashboard";

    for (const [pattern, target] of LEGACY_PREFIXES) {
        if (pattern.test(link)) return link.replace(pattern, target);
    }

    // Lien interne inconnu : on le rebase sous /dashboard plutôt que de
    // laisser un 404 (les pages publiques ne sont jamais des cibles de notif)
    return link.startsWith("/") ? `/dashboard${link}` : `/dashboard/${link}`;
}
