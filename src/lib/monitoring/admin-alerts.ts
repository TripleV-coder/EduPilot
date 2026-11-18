/**
 * Alertes de la plateforme vers ses super-administrateurs (2026-11-08) —
 * remplace SLACK_WEBHOOK_URL, PERFORMANCE_ALERT_EMAIL et les alertes Sentry.
 *
 * Aucun service ni variable à configurer : les destinataires sont les
 * comptes SUPER_ADMIN actifs (limités à ROOT_USER_EMAILS si la liste est
 * définie). Chaque alerte part par deux canaux :
 *  - notification dans l'application : instantanée (flux temps réel) et
 *    poussée sur les appareils abonnés ;
 *  - e-mail, quand l'envoi d'e-mails est configuré.
 * Une même alerte (`key`) n'est envoyée qu'une fois par période
 * (`throttleMs`), sur l'ensemble des instances (verrou en base) : une panne
 * qui se répète ne noie pas les boîtes de réception.
 * Ne lève jamais : une alerte qui échoue est journalisée, sans plus.
 */
import { prismaBase } from "@/lib/prisma";
import { counterSetIfAbsent, sharedStoreEnabled } from "@/lib/shared-state/pg";
import { logger } from "@/lib/utils/logger";

export interface AdminAlert {
    /** Identifiant de regroupement : une alerte par clé et par période. */
    key: string;
    title: string;
    message: string;
    /** Page de l'application à ouvrir (supervision par défaut). */
    link?: string;
    throttleMs?: number;
}

export type AlertOutcome = "sent" | "throttled" | "no-recipient" | "failed";

export const DEFAULT_ALERT_THROTTLE_MS = 30 * 60_000;
const MONITORING_LINK = "/dashboard/root-control/monitoring";

const localThrottle = new Map<string, number>();

/** Vrai si l'alerte peut partir (premier appel de la période). */
async function acquire(key: string, throttleMs: number): Promise<boolean> {
    if (sharedStoreEnabled()) {
        try {
            return await counterSetIfAbsent(`alert:${key}`, throttleMs);
        } catch {
            // base indisponible : repli sur le verrou local du processus
        }
    }
    const now = Date.now();
    const until = localThrottle.get(key);
    if (until && until > now) return false;
    localThrottle.set(key, now + throttleMs);
    if (localThrottle.size > 1000) for (const [k, v] of localThrottle) if (v <= now) localThrottle.delete(k);
    return true;
}

/** ROOT_USER_EMAILS (facultative), en minuscules comme les e-mails enregistrés. */
function rootAllowList(): string[] | null {
    const list = (process.env.ROOT_USER_EMAILS ?? "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
    return list.length > 0 ? list : null;
}

export async function alertPlatformAdmins(alert: AdminAlert): Promise<AlertOutcome> {
    try {
        if (!(await acquire(alert.key, alert.throttleMs ?? DEFAULT_ALERT_THROTTLE_MS))) return "throttled";

        const allowList = rootAllowList();
        const admins = await prismaBase.user.findMany({
            where: { role: "SUPER_ADMIN", isActive: true, ...(allowList ? { email: { in: allowList } } : {}) },
            select: { id: true, email: true },
        });
        if (admins.length === 0) return "no-recipient";

        const link = alert.link ?? MONITORING_LINK;
        await prismaBase.notification.createMany({
            data: admins.map((admin) => ({ userId: admin.id, type: "SYSTEM" as const, title: alert.title, message: alert.message, link })),
        });

        const { sendEmail } = await import("@/lib/email");
        await Promise.allSettled(
            admins.map((admin) =>
                sendEmail({
                    to: admin.email,
                    subject: `[EduPilot] ${alert.title}`,
                    text: `${alert.message}\n\nDétails : ${link}`,
                    html: `<p>${escapeHtml(alert.message)}</p><p>Détails : <code>${escapeHtml(link)}</code></p>`,
                }),
            ),
        );
        return "sent";
    } catch (error) {
        logger.warn("Alerte aux super-administrateurs non envoyée", {
            module: "monitoring/admin-alerts",
            key: alert.key,
            reason: error instanceof Error ? error.message : String(error),
        });
        return "failed";
    }
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

/** Pour les tests : oublie les verrous locaux. */
export function resetAlertThrottleForTests(): void {
    localThrottle.clear();
}
