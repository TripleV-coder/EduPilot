"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Permission } from "@/lib/rbac/permissions";
import {
    Bell, CheckCircle2, AlertTriangle, AlertCircle,
    Info, FileText, GraduationCap, CreditCard,
    UserPlus, Settings, CheckCheck, Loader2
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useNotificationStream } from "@/lib/socket";
import { motion, AnimatePresence } from "framer-motion";
import {
    NOTIFICATION_FILTERS,
    formatNotificationRelativeTime,
    toNotificationUiType,
    type NotificationUiType,
} from "@/lib/notifications/ui";
import { t } from "@/lib/i18n";

type NotificationType = "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "GRADE" | "PAYMENT" | "BULLETIN" | "ENROLLMENT" | "SYSTEM";

type NotificationItem = {
    id: string;
    type: NotificationType;
    uiType: NotificationUiType;
    title: string;
    message: string;
    link: string | null;
    isRead: boolean;
    createdAt: string;
};

const FLOW_TRANSITION = { duration: 0.24, ease: [0.16, 1, 0.3, 1] as const };

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<"all" | NotificationUiType>("all");
    const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/notifications?limit=50");
            if (!res.ok) throw new Error("Erreur de récupération");
            const data = await res.json();
            const list: NotificationItem[] = (data.notifications || []).map((n: any) => ({
                ...n,
                type: String(n.type || "INFO").toUpperCase() as NotificationType,
                uiType: toNotificationUiType(n.type),
            }));
            setNotifications(list);
        } catch (err: any) {
            setError(err.message);
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
                    type: (String(n.type || "INFO").toUpperCase() as NotificationType),
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
    const activeFilterCount = filter === "all" ? notifications.length : filteredNotifications.length;

    const markAllAsRead = async () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        try {
            const res = await fetch("/api/notifications", { method: "PATCH" });
            if (!res.ok) {
                throw new Error("Impossible de marquer toutes les notifications comme lues.");
            }
        } catch (err: any) {
            setError(err.message || "Erreur de mise à jour.");
            fetchNotifications();
        }
    };

    const markAsRead = async (id: string) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
        try {
            const res = await fetch(`/api/notifications/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
            });
            if (!res.ok) {
                throw new Error("Impossible de marquer la notification comme lue.");
            }
        } catch (err: any) {
            setError(err.message || "Erreur de mise à jour.");
            fetchNotifications();
        }
    };

    const getIcon = (type: NotificationType) => {
        switch (type) {
            case "SUCCESS": return <CheckCircle2 className="w-5 h-5 text-[hsl(var(--success))]" />;
            case "WARNING": return <AlertTriangle className="w-5 h-5 text-[hsl(var(--warning))]" />;
            case "ERROR": return <AlertCircle className="w-5 h-5 text-destructive" />;
            case "GRADE": return <FileText className="w-5 h-5 text-[hsl(var(--info))]" />;
            case "BULLETIN": return <GraduationCap className="w-5 h-5 text-primary" />;
            case "PAYMENT": return <CreditCard className="w-5 h-5 text-[hsl(var(--warning))]" />;
            case "ENROLLMENT": return <UserPlus className="w-5 h-5 text-[hsl(var(--success))]" />;
            case "SYSTEM": return <Settings className="w-5 h-5 text-slate-500" />;
            default: return <Info className="w-5 h-5 text-primary" />;
        }
    };

    const getBgColor = (type: NotificationType, isRead: boolean) => {
        if (isRead) return "bg-background";

        switch (type) {
            case "SUCCESS": return "bg-emerald-500/5";
            case "WARNING": return "bg-amber-500/5";
            case "ERROR": return "bg-red-500/5";
            case "GRADE": return "bg-blue-500/5";
            case "BULLETIN": return "bg-indigo-500/5";
            case "PAYMENT": return "bg-orange-500/5";
            case "ENROLLMENT": return "bg-teal-500/5";
            case "SYSTEM": return "bg-slate-500/5";
            default: return "bg-primary/5";
        }
    };

    return (
        <PageGuard permission={Permission.SCHOOL_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}>
            <div className="space-y-6 max-w-4xl mx-auto pb-12 dashboard-motion">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <PageHeader
                        title="Centre de Notifications"
                        description={`Vous avez ${unreadCount} notification${unreadCount !== 1 ? 's' : ''} non lue${unreadCount !== 1 ? 's' : ''}.`}
                        breadcrumbs={[
                            { label: "Tableau de bord", href: "/dashboard" },
                            { label: "Notifications" },
                        ]}
                    />
                    {unreadCount > 0 && (
                        <Button variant="outline" onClick={markAllAsRead} className="gap-2 shrink-0 touch-target action-critical">
                            <CheckCheck className="w-4 h-4" />
                            Tout marquer comme lu
                        </Button>
                    )}
                </div>

                <Card className="dashboard-block border-border bg-card/70" data-reveal>
                    <CardContent className="p-3">
                        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
                            {NOTIFICATION_FILTERS.map((f) => (
                                <motion.button
                                    key={f.id}
                                    onClick={() => setFilter(f.id)}
                                    whileTap={{ scale: 0.98 }}
                                    className={cn(
                                        "touch-target rounded-full border px-3 py-1 text-[11px] font-medium transition-all whitespace-nowrap",
                                        filter === f.id
                                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                            : "bg-background text-muted-foreground border-border hover:border-primary/35"
                                    )}
                                >
                                    {f.label}
                                </motion.button>
                            ))}
                            <span className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap">
                                {activeFilterCount} element{activeFilterCount > 1 ? "s" : ""}
                            </span>
                            {filter !== "all" && (
                                <Button variant="ghost" size="sm" className="h-9 text-[11px] touch-target" onClick={() => setFilter("all")}>
                                    {t("common.reset")}
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <AnimatePresence mode="wait">
                    {selectedNotification && (
                        <motion.div
                            key={selectedNotification.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={FLOW_TRANSITION}
                        >
                            <Card className="border-border shadow-sm bg-card/80">
                                <CardContent className="p-4 sm:p-5 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <h3 className="text-base font-semibold">{selectedNotification.title}</h3>
                                        <Button variant="ghost" size="sm" className="touch-target" onClick={() => setSelectedNotification(null)}>
                                            Fermer
                                        </Button>
                                    </div>
                                    <p className="text-sm text-foreground/90">{selectedNotification.message}</p>
                                    <div className="flex items-center gap-2">
                                        {!selectedNotification.isRead && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="touch-target"
                                                onClick={() => {
                                                    markAsRead(selectedNotification.id);
                                                    setSelectedNotification((prev) => (prev ? { ...prev, isRead: true } : prev));
                                                }}
                                            >
                                                Marquer comme lue
                                            </Button>
                                        )}
                                        {selectedNotification.link && (
                                            <Link href={selectedNotification.link}>
                                                <Button size="sm" className="touch-target action-critical">Ouvrir la page</Button>
                                            </Link>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>

                {error && (
                    <div className="p-4 rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] text-destructive flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                <Card className="dashboard-block border-border shadow-sm overflow-hidden min-h-[400px]" data-reveal>
                    <CardContent className="p-0 flex flex-col h-full">
                        {loading ? (
                            <div className="p-4 space-y-3">
                                {Array.from({ length: 7 }).map((_, idx) => (
                                    <div key={idx} className="h-16 rounded-lg bg-muted/40 skeleton-shimmer" />
                                ))}
                            </div>
                        ) : filteredNotifications.length === 0 ? (
                            <div className="flex-1 text-center py-20 flex flex-col justify-center bg-muted/10">
                                <Bell className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                                <h3 className="text-lg font-medium">Aucune notification</h3>
                                <p className="text-sm text-muted-foreground mt-1">Vous êtes à jour !</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/50">
                                {filteredNotifications.map(notif => (
                                    <motion.div
                                        key={notif.id}
                                        layout
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.16 }}
                                        className={`p-4 sm:p-5 flex gap-4 transition-colors hover:bg-muted/30 ${getBgColor(notif.type, notif.isRead)}`}
                                        onClick={() => {
                                            setSelectedNotification(notif);
                                            if (!notif.isRead) markAsRead(notif.id);
                                        }}
                                    >
                                        <div className="shrink-0 mt-1">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-background border shadow-sm`}>
                                                {getIcon(notif.type)}
                                            </div>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start gap-2 mb-1">
                                                <h4 className={`text-base font-semibold truncate ${notif.isRead ? 'text-foreground/80' : 'text-foreground'}`}>
                                                    {notif.title}
                                                </h4>
                                                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                                                    {formatNotificationRelativeTime(notif.createdAt)}
                                                </span>
                                            </div>

                                            <p className={`text-sm mb-2 ${notif.isRead ? 'text-muted-foreground' : 'text-foreground/90 font-medium'}`}>
                                                {notif.message}
                                            </p>

                                            {notif.link && (
                                                <Link href={notif.link} className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1">
                                                    {t("appActions.viewDetails")} &rarr;
                                                </Link>
                                            )}
                                        </div>

                                        {!notif.isRead && (
                                            <div className="shrink-0 flex items-center justify-center">
                                                <div className="w-2.5 h-2.5 bg-primary rounded-full shadow-sm" />
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </PageGuard>
    );
}
