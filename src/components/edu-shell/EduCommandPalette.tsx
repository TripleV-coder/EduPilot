"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

import { Icon, type IconName } from "@/components/edu";
import { navForRole, AI_ASSISTANT_NAV_LINK } from "./role-nav";

type Action = {
    id: string;
    label: string;
    hint?: string;
    icon: IconName;
    href?: string;
    onSelect?: () => void;
    keywords?: string;
    category: "Navigation" | "Action" | "Recherche";
};

function roleQuickActions(role: string | undefined | null): Action[] {
    switch (role) {
        case "TEACHER":
            return [
                { id: "qa-attendance", label: "Faire l'appel", hint: "Présences du jour", icon: "check", href: "/dashboard/attendance", category: "Action", keywords: "appel présence" },
                { id: "qa-grades", label: "Saisir des notes", hint: "Saisie rapide", icon: "pencil", href: "/dashboard/grades/entry", category: "Action", keywords: "notes saisie" },
            ];
        case "DIRECTOR":
        case "SCHOOL_ADMIN":
            return [
                { id: "qa-finance", label: "Encaisser un paiement", hint: "Finance scolarité", icon: "money", href: "/dashboard/finance", category: "Action", keywords: "paiement encaissement" },
                { id: "qa-students", label: "Voir les effectifs", hint: "Liste des élèves", icon: "users", href: "/dashboard/students", category: "Action", keywords: "élèves effectifs" },
            ];
        case "PARENT":
            return [
                { id: "qa-pay", label: "Payer les frais", hint: "Espace finance", icon: "money", href: "/dashboard/finance", category: "Action", keywords: "paiement frais" },
            ];
        case "ACCOUNTANT":
            return [
                { id: "qa-accounting", label: "Saisie comptable OHADA", hint: "Comptabilité", icon: "cards", href: "/dashboard/accounting", category: "Action", keywords: "ohada comptabilité" },
            ];
        default:
            return [];
    }
}

const STATIC_ACTIONS = (router: ReturnType<typeof useRouter>, role: string | undefined | null): Action[] => [
    {
        id: "act-profile",
        label: "Mon compte",
        hint: "Préférences, sécurité, langue",
        icon: "settings",
        href: "/dashboard/settings/profile",
        keywords: "compte profil mon",
        category: "Action",
    },
    {
        id: "act-logout",
        label: "Se déconnecter",
        hint: "Quitter la session en cours",
        icon: "x",
        onSelect: () => {
            void signOut({ callbackUrl: "/login" });
        },
        keywords: "logout déconnexion quitter session",
        category: "Action",
    },
    {
        id: "act-ai",
        label: AI_ASSISTANT_NAV_LINK.label,
        hint: "Aide pédago, génération bulletins",
        icon: AI_ASSISTANT_NAV_LINK.icon,
        href: AI_ASSISTANT_NAV_LINK.href,
        keywords: "ia ai assistant chat",
        category: "Action",
    },
    {
        id: "act-help",
        label: "Aide & support",
        hint: "Documentation et contact équipe",
        icon: "info",
        onSelect: () => {
            router.push("/dashboard/settings");
        },
        keywords: "aide support contact help",
        category: "Action",
    },
];

function buildActions(role: string | undefined | null, router: ReturnType<typeof useRouter>): Action[] {
    const navItems = navForRole(role).map<Action>((n, i) => ({
        id: `nav-${i}-${n.href}`,
        label: n.label,
        hint: n.href,
        icon: n.icon,
        href: n.href,
        keywords: `${n.label} ${n.href}`,
        category: "Navigation",
    }));
    return [...roleQuickActions(role), ...navItems, ...STATIC_ACTIONS(router, role)];
}

export interface EduCommandPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EduCommandPalette({ open, onOpenChange }: EduCommandPaletteProps) {
    const router = useRouter();
    const { data: session } = useSession();
    const role = session?.user?.role ?? null;

    const [query, setQuery] = React.useState("");
    const [activeIndex, setActiveIndex] = React.useState(0);
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const panelRef = React.useRef<HTMLDivElement | null>(null);
    const triggerRef = React.useRef<HTMLElement | null>(null);

    const actions = React.useMemo(() => buildActions(role, router), [role, router]);

    const filtered = React.useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return actions;
        return actions.filter((a) => {
            const hay = `${a.label} ${a.hint ?? ""} ${a.keywords ?? ""}`.toLowerCase();
            return hay.includes(q);
        });
    }, [actions, query]);

    const grouped = React.useMemo(() => {
        const map = new Map<Action["category"], Action[]>();
        for (const item of filtered) {
            const arr = map.get(item.category) ?? [];
            arr.push(item);
            map.set(item.category, arr);
        }
        if (query.trim()) {
            map.set("Recherche", [
                {
                    id: "search-students",
                    label: `Rechercher « ${query} » dans les élèves`,
                    icon: "search",
                    href: `/dashboard/students?search=${encodeURIComponent(query.trim())}`,
                    category: "Recherche",
                },
            ]);
        }
        return Array.from(map.entries());
    }, [filtered, query]);

    const flat = React.useMemo(
        () => grouped.flatMap(([, items]) => items),
        [grouped],
    );

    React.useEffect(() => {
        if (!open) return;
        triggerRef.current = document.activeElement as HTMLElement | null;
        setQuery("");
        setActiveIndex(0);
        const t = window.setTimeout(() => inputRef.current?.focus(), 30);
        return () => window.clearTimeout(t);
    }, [open]);

    React.useEffect(() => {
        if (!open) return;
        const onTabTrap = (event: KeyboardEvent) => {
            if (event.key !== "Tab" || !panelRef.current) return;
            const nodes = panelRef.current.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
            );
            if (nodes.length === 0) return;
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", onTabTrap);
        return () => document.removeEventListener("keydown", onTabTrap);
    }, [open]);

    React.useEffect(() => {
        setActiveIndex(0);
    }, [query]);

    const close = React.useCallback(() => {
        onOpenChange(false);
        window.setTimeout(() => triggerRef.current?.focus(), 0);
    }, [onOpenChange]);

    const execute = React.useCallback(
        (item: Action) => {
            if (item.onSelect) {
                item.onSelect();
            } else if (item.href) {
                router.push(item.href);
            }
            close();
        },
        [router, close],
    );

    React.useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                close();
                return;
            }
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
                return;
            }
            if (e.key === "Enter") {
                const target = flat[activeIndex];
                if (target) {
                    e.preventDefault();
                    execute(target);
                }
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, flat, activeIndex, execute, close]);

    if (!open) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Palette de commandes"
            className="eduflow-scope fixed inset-0 z-50 flex items-start justify-center px-4"
            style={{ paddingTop: "12vh" }}
        >
            <div
                aria-hidden
                onClick={close}
                style={{
                    position: "fixed",
                    inset: 0,
                    background: "var(--eduflow-overlay)",
                    backdropFilter: "blur(2px)",
                }}
            />

            <div
                ref={panelRef}
                style={{
                    position: "relative",
                    width: "min(640px, 100%)",
                    background: "var(--eduflow-surface-card)",
                    borderRadius: 16,
                    boxShadow: "var(--eduflow-shadow-overlay)",
                    border: "1px solid var(--eduflow-border-subtle)",
                    overflow: "hidden",
                    maxHeight: "70vh",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <label
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "14px 16px",
                        borderBottom: "1px solid var(--border-subtle)",
                    }}
                >
                    <Icon name="search" size={16} color="var(--text-tertiary)" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Rechercher une page, une action, un élève…"
                        aria-label="Saisir une commande"
                        style={{
                            flex: 1,
                            border: 0,
                            outline: "none",
                            background: "transparent",
                            fontFamily: "inherit",
                            fontSize: 14,
                            color: "var(--text-primary)",
                        }}
                    />
                    <kbd
                        aria-hidden
                        style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: 6,
                            background: "var(--surface-sunken)",
                            color: "var(--text-tertiary)",
                            border: "1px solid var(--border-subtle)",
                            fontFamily: "var(--eduflow-font-mono, monospace)",
                        }}
                    >
                        Esc
                    </kbd>
                </label>

                <div
                    role="listbox"
                    aria-label="Résultats"
                    style={{ overflowY: "auto", padding: "6px 0" }}
                >
                    {flat.length === 0 ? (
                        <div
                            style={{
                                padding: "24px 16px",
                                textAlign: "center",
                                fontSize: 13,
                                color: "var(--text-tertiary)",
                            }}
                        >
                            Aucune commande ne correspond à « {query} ».
                        </div>
                    ) : (
                        grouped.map(([category, items]) => (
                            <div key={category}>
                                <div
                                    style={{
                                        padding: "10px 16px 4px",
                                        fontSize: 10,
                                        fontWeight: 700,
                                        letterSpacing: "0.08em",
                                        textTransform: "uppercase",
                                        color: "var(--text-tertiary)",
                                    }}
                                >
                                    {category}
                                </div>
                                {items.map((item) => {
                                    const flatIndex = flat.indexOf(item);
                                    const isActive = flatIndex === activeIndex;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            role="option"
                                            aria-selected={isActive}
                                            onMouseEnter={() => setActiveIndex(flatIndex)}
                                            onClick={() => execute(item)}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 12,
                                                width: "100%",
                                                padding: "10px 16px",
                                                border: 0,
                                                background: isActive
                                                    ? "var(--brand-50)"
                                                    : "transparent",
                                                cursor: "pointer",
                                                textAlign: "left",
                                                fontFamily: "inherit",
                                                color: "var(--text-primary)",
                                                borderLeft: isActive
                                                    ? "3px solid var(--brand-600)"
                                                    : "3px solid transparent",
                                            }}
                                        >
                                            <span
                                                style={{
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: 8,
                                                    background: isActive
                                                        ? "var(--brand-100)"
                                                        : "var(--surface-sunken)",
                                                    display: "grid",
                                                    placeItems: "center",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <Icon
                                                    name={item.icon}
                                                    size={14}
                                                    color={
                                                        isActive
                                                            ? "var(--brand-700)"
                                                            : "var(--text-secondary)"
                                                    }
                                                />
                                            </span>
                                            <span style={{ flex: 1, minWidth: 0 }}>
                                                <span
                                                    style={{
                                                        display: "block",
                                                        fontSize: 13,
                                                        fontWeight: 600,
                                                        color: isActive
                                                            ? "var(--brand-900)"
                                                            : "var(--text-primary)",
                                                    }}
                                                >
                                                    {item.label}
                                                </span>
                                                {item.hint ? (
                                                    <span
                                                        style={{
                                                            display: "block",
                                                            fontSize: 11,
                                                            color: "var(--text-tertiary)",
                                                            marginTop: 1,
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        {item.hint}
                                                    </span>
                                                ) : null}
                                            </span>
                                            {isActive ? (
                                                <kbd
                                                    aria-hidden
                                                    style={{
                                                        fontSize: 10,
                                                        fontWeight: 600,
                                                        padding: "2px 6px",
                                                        borderRadius: 6,
                                                        background: "var(--brand-100)",
                                                        color: "var(--brand-700)",
                                                        fontFamily:
                                                            "var(--eduflow-font-mono, monospace)",
                                                    }}
                                                >
                                                    ↵
                                                </kbd>
                                            ) : null}
                                        </button>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>

                <div
                    style={{
                        padding: "8px 16px",
                        borderTop: "1px solid var(--border-subtle)",
                        background: "var(--surface-sunken)",
                        display: "flex",
                        gap: 16,
                        fontSize: 10,
                        color: "var(--text-tertiary)",
                    }}
                >
                    <span>
                        <kbd
                            style={{
                                fontFamily: "var(--eduflow-font-mono, monospace)",
                                marginRight: 4,
                            }}
                        >
                            ↑↓
                        </kbd>
                        naviguer
                    </span>
                    <span>
                        <kbd
                            style={{
                                fontFamily: "var(--eduflow-font-mono, monospace)",
                                marginRight: 4,
                            }}
                        >
                            ↵
                        </kbd>
                        sélectionner
                    </span>
                    <span>
                        <kbd
                            style={{
                                fontFamily: "var(--eduflow-font-mono, monospace)",
                                marginRight: 4,
                            }}
                        >
                            Esc
                        </kbd>
                        fermer
                    </span>
                </div>
            </div>
        </div>
    );
}
