import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { logger } from "@/lib/utils/logger";
import type { NotificationType, Prisma } from "@prisma/client";

type CatColor = "neutral" | "danger" | "warning" | "success" | "info" | "brand";

type Category = { key: string; label: string; color: CatColor };

// Role-tailored categories. Counts are filled in from the live data set.
const CATS_BY_ROLE: Record<string, Category[]> = {
    PARENT: [
        { key: "all", label: "Tout", color: "neutral" },
        { key: "urgent", label: "Urgent", color: "danger" },
        { key: "finance", label: "Paiements", color: "warning" },
        { key: "notes", label: "Notes & bulletins", color: "success" },
        { key: "absence", label: "Présences", color: "warning" },
        { key: "devoirs", label: "Devoirs & cours", color: "info" },
        { key: "evenement", label: "Événements", color: "brand" },
    ],
    STUDENT: [
        { key: "all", label: "Tout", color: "neutral" },
        { key: "notes", label: "Mes notes", color: "success" },
        { key: "devoirs", label: "Devoirs", color: "warning" },
        { key: "edt", label: "Mon emploi du temps", color: "info" },
        { key: "badges", label: "Badges & défis", color: "brand" },
        { key: "messages", label: "Messages prof", color: "success" },
        { key: "evenement", label: "Événements", color: "warning" },
    ],
    TEACHER: [
        { key: "all", label: "Tout", color: "neutral" },
        { key: "saisie", label: "Notes à saisir", color: "warning" },
        { key: "absence", label: "Absences classe", color: "danger" },
        { key: "messages", label: "Messages", color: "brand" },
        { key: "devoirs", label: "Devoirs rendus", color: "info" },
        { key: "ia", label: "Insights IA", color: "brand" },
        { key: "admin", label: "Conseils & réunions", color: "success" },
    ],
    DIRECTOR: [
        { key: "all", label: "Tout", color: "neutral" },
        { key: "urgent", label: "P0 incidents", color: "danger" },
        { key: "finance", label: "Finance", color: "warning" },
        { key: "notes", label: "Pédagogie", color: "success" },
        { key: "absence", label: "Vie scolaire", color: "warning" },
        { key: "ia", label: "Insights IA", color: "brand" },
        { key: "admin", label: "Gouvernance", color: "info" },
    ],
};
CATS_BY_ROLE.SCHOOL_ADMIN = CATS_BY_ROLE.DIRECTOR;
CATS_BY_ROLE.SUPER_ADMIN = CATS_BY_ROLE.DIRECTOR;
CATS_BY_ROLE.STAFF = CATS_BY_ROLE.DIRECTOR;
CATS_BY_ROLE.ACCOUNTANT = CATS_BY_ROLE.DIRECTOR;

// Map Prisma NotificationType → high-level category key for filtering
function categoryOf(type: NotificationType, _title: string, _message: string): string {
    switch (type) {
        case "PAYMENT":
            return "finance";
        case "GRADE":
        case "BULLETIN":
            return "notes";
        case "ATTENDANCE":
            return "absence";
        case "ENROLLMENT":
            return "admin";
        case "MESSAGE":
            return "messages";
        case "ERROR":
            return "urgent";
        case "WARNING":
            return "urgent";
        case "SUCCESS":
            return "notes";
        case "INFO":
        case "SYSTEM":
        default:
            return "evenement";
    }
}

type UiType = "urgent" | "success" | "warning" | "reminder" | "info" | "sms";

function uiTypeOf(type: NotificationType): UiType {
    switch (type) {
        case "ERROR":
            return "urgent";
        case "SUCCESS":
            return "success";
        case "WARNING":
            return "warning";
        case "PAYMENT":
            return "warning";
        case "ATTENDANCE":
            return "warning";
        case "GRADE":
        case "BULLETIN":
            return "success";
        case "MESSAGE":
            return "sms";
        case "SYSTEM":
            return "reminder";
        case "INFO":
        case "ENROLLMENT":
        default:
            return "info";
    }
}

type Bucket = "urgent" | "today" | "thisWeek" | "older";

function bucketOf(d: Date): Bucket {
    const ms = Date.now() - d.getTime();
    const h = ms / (1000 * 60 * 60);
    if (h < 24) return "urgent";
    if (h < 48) return "today";
    if (h < 24 * 7) return "thisWeek";
    return "older";
}

const BUCKET_META: Record<Bucket, { title: string; subtitle: string }> = {
    urgent: { title: "🔴 À traiter aujourd'hui", subtitle: "< 24h" },
    today: { title: "🎓 Côté école", subtitle: "aujourd'hui" },
    thisWeek: { title: "📨 Cette semaine", subtitle: "1-6 j" },
    older: { title: "📚 Plus ancien", subtitle: "1 semaine+" },
};

function relativeTime(d: Date): string {
    const ms = Date.now() - d.getTime();
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${Math.max(1, m)} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} h`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days} j`;
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export const GET = createApiHandler(async (request, { session }) => {
    try {
        const { searchParams } = new URL(request.url);
        const cat = searchParams.get("category") ?? "all";

        const where: Prisma.NotificationWhereInput = {
            userId: session.user.id,
        };

        const [notifications, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: 100,
            }),
            prisma.notification.count({
                where: { userId: session.user.id, isRead: false },
            }),
        ]);

        const role = session.user.role;
        const cats = CATS_BY_ROLE[role] ?? CATS_BY_ROLE.STAFF;

        // Decorate + categorize
        const decorated = notifications.map((n) => {
            const category = categoryOf(n.type, n.title, n.message);
            const uiType = uiTypeOf(n.type);
            const bucket = bucketOf(n.createdAt);
            const priority: "P0" | "P1" | "P2" =
                n.type === "ERROR"
                    ? "P0"
                    : n.type === "WARNING" ||
                      n.type === "PAYMENT" ||
                      n.type === "ATTENDANCE"
                    ? "P1"
                    : "P2";
            return {
                id: n.id,
                type: n.type,
                category,
                uiType,
                priority,
                title: n.title,
                body: n.message,
                link: n.link,
                isRead: n.isRead,
                createdAt: n.createdAt.toISOString(),
                relativeTime: relativeTime(n.createdAt),
                bucket,
            };
        });

        // Apply category filter
        const filtered =
            cat === "all" ? decorated : decorated.filter((n) => n.category === cat);

        // Counts per category (across full set, not just filtered)
        const categoryCounts = new Map<string, number>(cats.map((c) => [c.key, 0]));
        categoryCounts.set("all", decorated.length);
        for (const n of decorated) {
            categoryCounts.set(n.category, (categoryCounts.get(n.category) ?? 0) + 1);
        }
        const categories = cats.map((c) => ({
            ...c,
            count: categoryCounts.get(c.key) ?? 0,
        }));

        // Group filtered items into buckets
        const buckets: Bucket[] = ["urgent", "today", "thisWeek", "older"];
        const groups = buckets
            .map((b) => ({
                bucket: b,
                title: BUCKET_META[b].title,
                subtitle: BUCKET_META[b].subtitle,
                items: filtered.filter((n) => n.bucket === b),
            }))
            .filter((g) => g.items.length > 0);

        // Preview: first unread urgent, else first item
        const previewBase =
            filtered.find((n) => !n.isRead && n.priority === "P0") ??
            filtered.find((n) => !n.isRead) ??
            filtered[0] ??
            null;

        const preview = previewBase
            ? {
                  id: previewBase.id,
                  accent: previewBase.uiType === "success"
                      ? "success"
                      : previewBase.uiType === "warning"
                      ? "warning"
                      : previewBase.uiType === "urgent"
                      ? "danger"
                      : "info",
                  badge:
                      previewBase.priority === "P0"
                          ? "PRIORITÉ HAUTE"
                          : previewBase.uiType === "success"
                          ? "🎉 RÉUSSITE"
                          : previewBase.uiType === "sms"
                          ? "MESSAGE"
                          : "INFO",
                  title: previewBase.title,
                  time: `Reçu il y a ${previewBase.relativeTime}`,
                  body: previewBase.body,
                  link: previewBase.link,
              }
            : null;

        return NextResponse.json({
            role,
            unreadCount,
            categories,
            groups,
            preview,
            totalCount: decorated.length,
        });
    } catch (error) {
        logger.error("notifications feed:", error as Error);
        return NextResponse.json(
            { error: "Erreur lors du chargement du centre de notifications" },
            { status: 500 }
        );
    }
});
