"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { Button, Logo } from "@/components/edu";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";

const NAV_LINKS = [
    { href: "#features", label: "Fonctionnalités" },
    { href: "#pricing", label: "Tarifs" },
    { href: "#faq", label: "FAQ" },
    { href: "/explorer", label: "Explorer 3D" },
] as const;

function isInternalRoute(href: string) {
    return href.startsWith("/");
}

export function Navbar() {
    const { status } = useSession();
    const isAuthenticated = status === "authenticated";
    const [open, setOpen] = useState(false);

    return (
        <nav
            className="eduflow-scope fixed left-0 right-0 top-0 z-50 border-b backdrop-blur-md"
            style={{
                background: "color-mix(in srgb, var(--eduflow-surface-card) 88%, transparent)",
                borderColor: "var(--eduflow-border-subtle)",
            }}
        >
            <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
                <Link href="/" className="group flex items-center gap-2.5">
                    <Logo size={36} />
                    <span
                        className="eduflow-display text-xl tracking-tight"
                        style={{ color: "var(--eduflow-text-primary)" }}
                    >
                        EduPilot
                    </span>
                </Link>

                <div className="hidden items-center gap-8 md:flex">
                    {NAV_LINKS.map((link) =>
                        isInternalRoute(link.href) ? (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="text-sm font-medium transition-colors hover:text-[var(--eduflow-text-primary)]"
                                style={{ color: "var(--eduflow-text-secondary)" }}
                            >
                                {link.label}
                            </Link>
                        ) : (
                            <a
                                key={link.href}
                                href={link.href}
                                className="text-sm font-medium transition-colors hover:text-[var(--eduflow-text-primary)]"
                                style={{ color: "var(--eduflow-text-secondary)" }}
                            >
                                {link.label}
                            </a>
                        )
                    )}
                </div>

                <div className="flex items-center gap-2 md:gap-4">
                    {status === "loading" ? (
                        <div className="h-9 w-[140px] animate-pulse rounded-input bg-[var(--eduflow-surface-sunken)] md:w-[180px]" />
                    ) : isAuthenticated ? (
                        <Link href="/dashboard">
                            <Button variant="primary" size="sm">
                                Accéder au tableau de bord
                            </Button>
                        </Link>
                    ) : (
                        <>
                            <Link href="/login" className="hidden sm:inline-flex">
                                <Button variant="ghost" size="sm">
                                    Connexion
                                </Button>
                            </Link>
                            <Link href="/setup">
                                <Button variant="primary" size="sm">
                                    Configuration initiale
                                </Button>
                            </Link>
                        </>
                    )}

                    <Sheet open={open} onOpenChange={setOpen}>
                        <SheetTrigger asChild>
                            <button
                                type="button"
                                className="grid h-10 w-10 place-items-center rounded-input border md:hidden"
                                style={{
                                    borderColor: "var(--eduflow-border-default)",
                                    background: "var(--eduflow-surface-card)",
                                }}
                                aria-label="Ouvrir le menu"
                            >
                                <span className="sr-only">Menu</span>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                                    <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </button>
                        </SheetTrigger>
                        <SheetContent side="right" className="eduflow-scope w-[min(100vw-2rem,320px)]">
                            <SheetHeader>
                                <SheetTitle>Menu</SheetTitle>
                            </SheetHeader>
                            <div className="mt-6 flex flex-col gap-2">
                                {NAV_LINKS.map((link) =>
                                    isInternalRoute(link.href) ? (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            onClick={() => setOpen(false)}
                                            className="rounded-input px-3 py-2 text-sm font-medium"
                                            style={{
                                                color: "var(--eduflow-text-primary)",
                                                background: "var(--eduflow-surface-sunken)",
                                            }}
                                        >
                                            {link.label}
                                        </Link>
                                    ) : (
                                        <a
                                            key={link.href}
                                            href={link.href}
                                            onClick={() => setOpen(false)}
                                            className="rounded-input px-3 py-2 text-sm font-medium"
                                            style={{
                                                color: "var(--eduflow-text-primary)",
                                                background: "var(--eduflow-surface-sunken)",
                                            }}
                                        >
                                            {link.label}
                                        </a>
                                    )
                                )}
                                {!isAuthenticated ? (
                                    <Link href="/login" onClick={() => setOpen(false)} className="mt-4">
                                        <Button variant="secondary" full>
                                            Connexion
                                        </Button>
                                    </Link>
                                ) : null}
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </nav>
    );
}
