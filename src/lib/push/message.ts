/**
 * Contenu des notifications push, construit à partir des notifications de
 * l'application (titre, message, lien). Plusieurs notifications reçues ensemble
 * par une même personne deviennent un seul résumé : pas de rafale sur l'écran
 * verrouillé quand 20 notes sont publiées d'un coup.
 */
export interface PushItem {
    userId: string;
    title: string;
    body: string;
    link: string | null;
    /** Absent pour une insertion groupée (createMany). */
    notificationId: string | null;
}

export interface PushMessage {
    title: string;
    body: string;
    /** Chemin de l'application ouvert au clic. */
    url: string;
    tag?: string;
}

export const NOTIFICATIONS_PAGE = "/dashboard/notifications";
const TITLE_MAX = 80;
const BODY_MAX = 200;

function clip(text: string, max: number): string {
    const clean = text.replace(/\s+/g, " ").trim();
    return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** Seuls les chemins internes sont ouverts au clic (« /… », jamais « //… » ni une URL). */
export function safeAppPath(link: string | null | undefined): string {
    if (!link || !link.startsWith("/") || link.startsWith("//") || link.includes("\\")) return NOTIFICATIONS_PAGE;
    return link;
}

export function buildPushMessage(items: readonly PushItem[]): PushMessage | null {
    if (items.length === 0) return null;
    if (items.length === 1) {
        const [item] = items;
        return { title: clip(item.title || "EduPilot", TITLE_MAX), body: clip(item.body, BODY_MAX), url: safeAppPath(item.link) };
    }
    const [first] = items;
    return {
        title: "EduPilot",
        body: clip(`${items.length} nouvelles notifications — ${first.title}`, BODY_MAX),
        url: NOTIFICATIONS_PAGE,
        tag: "edupilot-summary",
    };
}

type NotificationData = { userId?: unknown; user?: { connect?: { id?: unknown } }; title?: unknown; message?: unknown; link?: unknown };
type NotificationRow = { id?: unknown; userId?: unknown; title?: unknown; message?: unknown; link?: unknown };

function toItem(data: NotificationData, row?: NotificationRow): PushItem | null {
    const userId = typeof data.userId === "string" ? data.userId : typeof data.user?.connect?.id === "string" ? data.user.connect.id : row?.userId;
    const title = typeof data.title === "string" ? data.title : row?.title;
    const body = typeof data.message === "string" ? data.message : row?.message;
    if (typeof userId !== "string" || typeof title !== "string" || typeof body !== "string") return null;
    const link = typeof data.link === "string" ? data.link : typeof row?.link === "string" ? row.link : null;
    return { userId, title, body, link, notificationId: typeof row?.id === "string" ? row.id : null };
}

/** Notifications créées par une opération Prisma (create, createMany, createManyAndReturn). */
export function itemsFromNotificationWrite(operation: string, args: unknown, result: unknown): PushItem[] {
    const data = (args as { data?: unknown } | undefined)?.data;
    if (operation === "create") {
        const item = data && typeof data === "object" ? toItem(data as NotificationData, result as NotificationRow) : null;
        return item ? [item] : [];
    }
    const rows = Array.isArray(data) ? data : data ? [data] : [];
    const returned = operation === "createManyAndReturn" && Array.isArray(result) ? (result as NotificationRow[]) : [];
    return rows
        .map((row, index) => toItem(row as NotificationData, returned[index]))
        .filter((item): item is PushItem => item !== null);
}
