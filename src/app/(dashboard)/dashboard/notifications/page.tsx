"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";
import { useNotificationStream } from "@/lib/socket";
import {
    NOTIFICATION_FILTERS,
    formatNotificationRelativeTime,
    toNotificationUiType,
    type NotificationUiType,
} from "@/lib/notifications/ui";
import { t } from "@/lib/i18n";

import {
    Badge,
    Button,
    Card,
    Icon,
    Spinner,
    type IconName,
} from "@/components/edu";
import { PageHeader } from "@/components/edu-homes/_shared";

type NotificationType =
    | "INFO"
    | "SUCCESS"
    | "WARNING"
    | "ERROR"
    | "GRADE"
    | "PAYMENT"
    | "BULLETIN"
    | "ENROLLMENT"
    | "SYSTEM";

interface NotificationItem {
    id: string;
    type: NotificationType;
    uiType: NotificationUiType;
    title: string;
    message: string;
    link: string | null;
    isRead: boolean;
    createdAt: string;
}

const TYPE_ICON: Record<NotificationType, IconName> = {
    SUCCESS: "success",
    WARNING: "warning",
    ERROR: "danger",
    GRADE: "pencil",
    PAYMENT: "money",
    BULLETIN: "cards",
    ENROLLMENT: "users",
    SYSTEM: "settings",
    INFO: "info",
};

const TYPE_VARIANT: Record<NotificationType, "success" | "warning" | "danger" | "info" | "brand" | "neutral"> = {
    SUCCESS: "success",
    WARNING: "warning",
    ERROR: "danger",
    GRADE: "info",
    PAYMENT: "warning",
    BULLETIN: "brand",
    ENROLLMENT: "success",
    SYSTEM: "neutral",
    INFO: "info",
};

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<"all" | NotificationUiType>("all");

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/notifications?limit=50");
            if (!res.ok) throw new Error("Erreur de récupération");
            const data = await res.json();
            const list: NotificationItem[] = (data.notifications || []).map((n: { type?: string; [k: string]: unknown }) => ({
                ...(n as Record<string, unknown>),
                type: String(n.type || "INFO").toUpperCase() as NotificationType,
                uiType: toNotificationUiType(n.type),
            })) as NotificationItem[];
            setNotifications(list);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    useNotificationStream({
        enabled: true,
        onNotification: (items) => {
            if (!items?.length) return;
            setNotifications((prev) => {
                const mapped: NotificationItem[] = items.map((n) => ({
                    id: n.id,
                    type: String(n.type || "INFO").toUpperCase() as NotificationType,
                    uiType: toNotificationUiType(n.type),
                    title: n.title,
                    message: n.message,
                    link: n.link || null,
                    isRead: !!n.isRead,
                    createdAt: n.createdAt,
                }));
                const ids = new Set(prev.map((p) => p.id));
                const deduped = mapped.filter((m) => !ids.has(m.id));
                return [...deduped, ...prev].slice(0, 120);
            });
        },
    });

    const unreadCount = useMemo(
        () => notifications.filter((n) => !n.isRead).length,
        [notifications]
    );

    const filteredNotifications = useMemo(
        () => notifications.filter((n) => (filter === "all" ? true : n.uiType === filter)),
        [filter, notifications]
    );

    const markAllAsRead = async () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        try {
            const res = await fetch("/api/notifications", { method: "PATCH" });
            if (!res.ok) throw new Error("Impossible de marquer toutes comme lues.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur de mise à jour");
            fetchNotifications();
        }
    };

    const markAsRead = async (id: string) => {
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        try {
            const res = await fetch(`/api/notifications/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
            });
            if (!res.ok) throw new Error("Impossible de marquer comme lue.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur de mise à jour");
            fetchNotifications();
        }
    };

    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}
        >
            <div className="eduflow-scope mx-auto flex max-w-4xl flex-col gap-4 pb-12">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <PageHeader
                        greeting="Notifications"
                        sub={
                            unreadCount === 0
                                ? "Tu es à jour — aucune notification non lue."
                                : `${unreadCount} notification${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}.`
                        }
                    />
                    {unreadCount > 0 ? (
                        <Button variant="secondary" icon="check" onClick={markAllAsRead}>
                            Tout marquer comme lu
                        </Button>
                    ) : null}
                </div>

                <Card padding={10}>
                    <div className="flex flex-wrap items-center gap-2">
                        {NOTIFICATION_FILTERS.map((f) => {
                            const active = filter === f.id;
                            return (
                                <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => setFilter(f.id)}
                                    style={{
                                        padding: "6px 12px",
                                        background: active
                                            ? "var(--brand-700)"
                                            : "var(--eduflow-surface-card)",
                                        color: active
                                            ? "var(--eduflow-text-on-brand)"
                                            : "var(--eduflow-text-secondary)",
                                        border: active
                                            ? "1px solid transparent"
                                            : "1px solid var(--eduflow-border-default)",
                                        borderRadius: "var(--eduflow-radius-full)",
                                        fontFamily: "inherit",
                                        fontSize: 12,
                                        fontWeight: active ? 700 : 500,
                                        cursor: "pointer",
                                        transition:
                                            "all var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                                    }}
                                >
                                    {f.label}
                                </button>
                            );
                        })}
                        {filter !== "all" ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                icon="x"
                                onClick={() => setFilter("all")}
                            >
                                {t("common.reset")}
                            </Button>
                        ) : null}
                    </div>
                </Card>

                {error ? (
                    <Card
                        padding={14}
                        style={{
                            borderLeft: "3px solid var(--eduflow-danger-500)",
                            background: "var(--eduflow-danger-50)",
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <Icon name="warning" size={18} color="var(--eduflow-danger-600)" />
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 13,
                                    color: "var(--eduflow-danger-800)",
                                    fontWeight: 500,
                                }}
                            >
                                {error}
                            </p>
                        </div>
                    </Card>
                ) : null}

                <Card padding={0}>
                    {loading ? (
                        <div className="flex items-center gap-3 px-5 py-8">
                            <Spinner size={18} color="var(--brand-600)" />
                            <span style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                                Chargement des notifications…
                            </span>
                        </div>
                    ) : filteredNotifications.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
                            <div
                                className="grid place-items-center"
                                style={{
                                    width: 60,
                                    height: 60,
                                    borderRadius: 16,
                                    background: "var(--brand-50)",
                                }}
                            >
                                <Icon name="bell" size={26} color="var(--brand-700)" />
                            </div>
                            <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                Aucune notification
                            </h3>
                            <p
                                style={{
                                    fontSize: 13,
                                    color: "var(--eduflow-text-secondary)",
                                    margin: 0,
                                }}
                            >
                                Tu es à jour !
                            </p>
                        </div>
                    ) : (
                        filteredNotifications.map((notif, idx) => (
                            <NotifRow
                                key={notif.id}
                                notif={notif}
                                isFirst={idx === 0}
                                onMarkRead={() => markAsRead(notif.id)}
                            />
                        ))
                    )}
                </Card>
            </div>
        </PageGuard>
    );
}

function NotifRow({
    notif,
    isFirst,
    onMarkRead,
}: {
    notif: NotificationItem;
    isFirst: boolean;
    onMarkRead: () => void;
}) {
    const variant = TYPE_VARIANT[notif.type] ?? "info";
    const icon = TYPE_ICON[notif.type] ?? "info";
    const accentBg =
        variant === "brand" ? "var(--brand-50)" : `var(--eduflow-${variant}-50)`;
    const accentFg =
        variant === "brand" ? "var(--brand-700)" : `var(--eduflow-${variant}-700)`;

    return (
        <div
            className="flex gap-3 px-5 py-4"
            style={{
                borderTop: isFirst ? "none" : "1px solid var(--eduflow-border-subtle)",
                background: notif.isRead ? "transparent" : "var(--brand-50)",
                transition:
                    "background var(--eduflow-motion-fast) var(--eduflow-ease-out)",
            }}
        >
            <div
                className="grid place-items-center"
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: accentBg,
                    color: accentFg,
                    flexShrink: 0,
                }}
            >
                <Icon name={icon} size={18} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <h4
                        style={{
                            margin: 0,
                            fontSize: 14,
                            fontWeight: notif.isRead ? 500 : 700,
                            color: notif.isRead
                                ? "var(--eduflow-text-secondary)"
                                : "var(--eduflow-text-primary)",
                        }}
                    >
                        {notif.title}
                    </h4>
                    <span
                        className="eduflow-mono"
                        style={{
                            fontSize: 10,
                            color: "var(--eduflow-text-tertiary)",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {formatNotificationRelativeTime(notif.createdAt)}
                    </span>
                </div>
                <p
                    style={{
                        margin: "4px 0 0",
                        fontSize: 13,
                        color: "var(--eduflow-text-secondary)",
                        lineHeight: 1.5,
                    }}
                >
                    {notif.message}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                    {!notif.isRead ? (
                        <Badge variant={variant} size="sm" dot>
                            Non lu
                        </Badge>
                    ) : null}
                    {notif.link ? (
                        <Link
                            href={notif.link}
                            style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--brand-700)",
                                textDecoration: "none",
                            }}
                        >
                            Voir le détail →
                        </Link>
                    ) : null}
                    {!notif.isRead ? (
                        <button
                            type="button"
                            onClick={onMarkRead}
                            style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "var(--eduflow-text-tertiary)",
                                background: "transparent",
                                border: 0,
                                cursor: "pointer",
                                padding: 0,
                                fontFamily: "inherit",
                            }}
                        >
                            Marquer comme lue
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
