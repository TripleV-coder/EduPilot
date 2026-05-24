"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import useSWR from "swr";

import { Avatar, Button, Icon } from "@/components/edu";
import { useSidebar } from "@/components/dashboard/DashboardLayoutClient";
import { useCommandPalette } from "@/components/edu-shell/CommandPaletteProvider";
import { fetcher } from "@/lib/fetcher";
import { ROLE_LABELS } from "./role-nav";

export function EduTopBar() {
    const { data: session } = useSession();
    const { setIsMobileOpen } = useSidebar();
    const { open: openPalette } = useCommandPalette();
    const isMac =
        typeof navigator !== "undefined" &&
        /(Mac|iPhone|iPad|iPod)/i.test(navigator.platform);

    const role = session?.user?.role ?? "STAFF";
    const userName = session?.user?.name || "Utilisateur";

    const { data: notifs } = useSWR<{ unreadCount?: number }>(
        session?.user ? "/api/notifications?unread=true&limit=1" : null,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 60000, shouldRetryOnError: false }
    );
    const unreadCount = notifs?.unreadCount ?? 0;

    return (
        <header
            className="eduflow-scope sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b px-4 md:px-6"
            style={{
                background: "var(--eduflow-surface-card)",
                borderColor: "var(--eduflow-border-subtle)",
                color: "var(--eduflow-text-primary)",
                fontFamily: "var(--eduflow-font-body)",
            }}
        >
            <button
                type="button"
                onClick={() => setIsMobileOpen(true)}
                aria-label="Ouvrir le menu"
                className="grid h-10 w-10 place-items-center rounded-md md:hidden"
                style={{ background: "transparent", border: 0, cursor: "pointer" }}
            >
                <Icon name="grid" size={18} color="var(--eduflow-text-secondary)" />
            </button>

            <button
                type="button"
                onClick={openPalette}
                aria-label="Ouvrir la palette de commandes (Ctrl+K)"
                className="hidden flex-1 md:flex"
                style={{
                    maxWidth: 380,
                    height: 40,
                    alignItems: "center",
                    gap: 10,
                    padding: "0 12px",
                    borderRadius: 8,
                    background: "var(--eduflow-surface-sunken)",
                    border: "1px solid transparent",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition:
                        "border-color var(--eduflow-motion-fast) var(--eduflow-ease-out), background var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                }}
            >
                <Icon name="search" size={16} color="var(--eduflow-text-tertiary)" />
                <span
                    style={{
                        flex: 1,
                        textAlign: "left",
                        fontSize: 13,
                        color: "var(--eduflow-text-tertiary)",
                    }}
                >
                    Rechercher une page, un élève, une action…
                </span>
                <kbd
                    aria-hidden
                    style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "2px 6px",
                        borderRadius: 6,
                        background: "var(--eduflow-surface-card)",
                        color: "var(--eduflow-text-secondary)",
                        border: "1px solid var(--eduflow-border-subtle)",
                        fontFamily: "var(--eduflow-font-mono, monospace)",
                    }}
                >
                    {isMac ? "⌘K" : "Ctrl+K"}
                </kbd>
            </button>

            <div className="flex-1 md:hidden" />

            <Link href="/dashboard/ai-assistant" className="hidden md:inline-flex">
                <Button variant="ghost" size="sm" icon="sparkle">
                    Assistant IA
                </Button>
            </Link>

            <Link
                href="/dashboard/notifications"
                aria-label="Notifications"
                className="relative grid h-10 w-10 place-items-center rounded-md"
                style={{
                    background: "transparent",
                    transition: "background var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                }}
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
                <Avatar name={userName} size="sm" status="online" />
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
