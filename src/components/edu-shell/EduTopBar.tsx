"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import useSWR from "swr";

import { Avatar, Button, Icon } from "@/components/edu";
import { useSidebar } from "@/components/dashboard/DashboardLayoutClient";
import { useCommandPalette } from "@/components/edu-shell/CommandPaletteProvider";
import { fetcher } from "@/lib/fetcher";
import { toggleLightDark } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, AI_ASSISTANT_NAV_LINK } from "./role-nav";

const iconBtnClass =
    "grid h-10 w-10 place-items-center rounded-md border-0 bg-transparent cursor-pointer transition-colors hover:bg-[var(--eduflow-surface-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50";

export function EduTopBar() {
    const { data: session } = useSession();
    const { toggle, setIsMobileOpen } = useSidebar();
    const { open: openPalette } = useCommandPalette();
    const [isMac, setIsMac] = React.useState(false);
    const [isOnline, setIsOnline] = React.useState(true);
    const [isDark, setIsDark] = React.useState(false);

    React.useEffect(() => {
        setIsMac(/(Mac|iPhone|iPad|iPod)/i.test(navigator.userAgent));
        setIsOnline(navigator.onLine);
        setIsDark(document.documentElement.classList.contains("dark"));

        const onOnline = () => setIsOnline(true);
        const onOffline = () => setIsOnline(false);
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
        };
    }, []);

    const role = session?.user?.role ?? "STAFF";
    const userName = session?.user?.name || "Utilisateur";

    const { data: notifs } = useSWR<{ unreadCount?: number }>(
        session?.user ? "/api/notifications?unread=true&limit=1" : null,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 60000, shouldRetryOnError: false }
    );
    const unreadCount = notifs?.unreadCount ?? 0;

    const handleMenuClick = () => {
        if (window.innerWidth < 768) {
            setIsMobileOpen(true);
            return;
        }
        toggle();
    };

    const handleThemeToggle = () => {
        const next = toggleLightDark();
        setIsDark(next === "dark");
    };

    const searchButton = (
        <button
            type="button"
            onClick={openPalette}
            aria-label="Ouvrir la palette de commandes"
            className={cn(
                "flex items-center gap-2.5 rounded-input border border-transparent bg-[var(--eduflow-surface-sunken)] px-3 transition-colors hover:border-[var(--eduflow-border-default)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50",
                "h-10 flex-1 md:max-w-[380px]"
            )}
        >
            <Icon name="search" size={16} color="var(--eduflow-text-tertiary)" />
            <span
                className="hidden flex-1 text-left text-[13px] text-[var(--eduflow-text-tertiary)] sm:inline"
            >
                Rechercher une page, un élève, une action…
            </span>
            <span className="flex-1 text-left text-[13px] text-[var(--eduflow-text-tertiary)] sm:hidden">
                Rechercher…
            </span>
            <kbd
                aria-hidden
                suppressHydrationWarning
                className="hidden rounded-md border border-[var(--eduflow-border-subtle)] bg-[var(--eduflow-surface-card)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--eduflow-text-secondary)] md:inline"
                style={{ fontFamily: "var(--eduflow-font-mono, monospace)" }}
            >
                {isMac ? "⌘K" : "Ctrl+K"}
            </kbd>
        </button>
    );

    return (
        <header
            className="eduflow-scope sticky top-0 z-30 flex h-[60px] items-center gap-2 border-b px-3 md:gap-3 md:px-6"
            style={{
                background: "var(--eduflow-surface-card)",
                borderColor: "var(--eduflow-border-subtle)",
                color: "var(--eduflow-text-primary)",
                fontFamily: "var(--eduflow-font-body)",
            }}
        >
            <button
                type="button"
                onClick={handleMenuClick}
                aria-label="Ouvrir ou replier le menu"
                className={iconBtnClass}
            >
                <Icon name="grid" size={18} color="var(--eduflow-text-secondary)" />
            </button>

            {searchButton}

            <Link href={AI_ASSISTANT_NAV_LINK.href} className="hidden md:inline-flex">
                <Button variant="ghost" size="sm" icon={AI_ASSISTANT_NAV_LINK.icon}>
                    {AI_ASSISTANT_NAV_LINK.label}
                </Button>
            </Link>

            <button
                type="button"
                onClick={handleThemeToggle}
                aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
                className={cn(iconBtnClass, "hidden sm:grid")}
            >
                <Icon name={isDark ? "sun" : "moon"} size={18} color="var(--eduflow-text-secondary)" />
            </button>

            <Link
                href="/dashboard/notifications"
                aria-label="Notifications"
                className={cn(iconBtnClass, "relative")}
            >
                <Icon name="bell" size={18} color="var(--eduflow-text-secondary)" />
                {unreadCount > 0 ? (
                    <span
                        className="absolute"
                        style={{
                            top: 9,
                            right: 10,
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            background: "var(--eduflow-danger-500)",
                            boxShadow: "0 0 0 2px var(--eduflow-surface-card)",
                        }}
                    />
                ) : null}
            </Link>

            <span
                className="hidden h-8 md:block"
                style={{ width: 1, background: "var(--eduflow-border-subtle)" }}
            />

            <Link
                href="/dashboard/settings/profile"
                className="flex items-center gap-2.5"
                style={{ textDecoration: "none", color: "inherit" }}
            >
                <Avatar
                    name={userName}
                    size="sm"
                    status={isOnline ? "online" : undefined}
                />
                <div className="hidden md:block">
                    <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{userName}</div>
                    <div style={{ fontSize: 10, color: "var(--eduflow-text-tertiary)" }}>
                        {ROLE_LABELS[role] ?? role}
                    </div>
                </div>
            </Link>
        </header>
    );
}
