"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";

import { Avatar, Button, Icon } from "@/components/edu";
import { useSidebar } from "@/components/dashboard/DashboardLayoutClient";
import { fetcher } from "@/lib/fetcher";
import { ROLE_LABELS } from "./role-nav";

export function EduTopBar() {
    const router = useRouter();
    const { data: session } = useSession();
    const { setIsMobileOpen } = useSidebar();
    const [search, setSearch] = React.useState("");

    const role = session?.user?.role ?? "STAFF";
    const userName = session?.user?.name || "Utilisateur";

    const { data: notifs } = useSWR<{ unreadCount?: number }>(
        session?.user ? "/api/notifications?unread=true&limit=1" : null,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 60000, shouldRetryOnError: false }
    );
    const unreadCount = notifs?.unreadCount ?? 0;

    const onSubmitSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const q = search.trim();
        if (!q) return;
        router.push(`/dashboard/students?search=${encodeURIComponent(q)}`);
    };

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

            <form
                onSubmit={onSubmitSearch}
                className="hidden flex-1 md:block"
                style={{ maxWidth: 380 }}
            >
                <label
                    className="flex h-10 items-center gap-2 rounded-md px-3"
                    style={{
                        background: "var(--eduflow-surface-sunken)",
                        border: "1px solid transparent",
                        transition: "border-color var(--eduflow-motion-fast) var(--eduflow-ease-out), background var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                    }}
                >
                    <Icon name="search" size={16} color="var(--eduflow-text-tertiary)" />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher élève, classe, matière…"
                        className="flex-1 bg-transparent outline-none"
                        style={{
                            fontFamily: "inherit",
                            fontSize: 13,
                            color: "var(--eduflow-text-primary)",
                            border: 0,
                        }}
                    />
                </label>
            </form>

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
