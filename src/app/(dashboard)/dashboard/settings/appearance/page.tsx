"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { AUTHENTICATED_DASHBOARD_ROLES } from "@/lib/rbac/permissions";
import { useSidebar } from "@/components/dashboard/DashboardLayoutClient";

import { Badge, Card, Icon, type IconName } from "@/components/edu";
import { PageHeader } from "@/components/edu-homes/_shared";

type ThemeValue = "light" | "dark" | "system";
type DisplayMode = "comfort" | "dense" | "focus";

type ProfileResponse = {
    preferences?: Record<string, unknown> | null;
};

function applyTheme(theme: ThemeValue) {
    const root = document.documentElement;
    if (theme === "dark") {
        root.classList.add("dark");
        return;
    }
    if (theme === "light") {
        root.classList.remove("dark");
        return;
    }
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
}

const DISPLAY_MODES: { id: DisplayMode; title: string; description: string; icon: IconName }[] = [
    {
        id: "comfort",
        title: "Confort",
        description: "Lignes 44px, texte 13px, espacement standard. Idéal pour l'usage quotidien.",
        icon: "cards",
    },
    {
        id: "dense",
        title: "Dense",
        description: "Lignes 32px et espacement réduit pour afficher un maximum de données.",
        icon: "grid",
    },
    {
        id: "focus",
        title: "Focus",
        description: "Masque la sidebar et réduit l'interface pour se concentrer sur le contenu.",
        icon: "sparkle",
    },
];

const THEMES: { id: ThemeValue; title: string; description: string; icon: IconName }[] = [
    { id: "light", title: "Clair", description: "Mode jour standard.", icon: "sun" },
    { id: "dark", title: "Sombre", description: "Mode nuit, économise la rétine.", icon: "moon" },
    { id: "system", title: "Système", description: "Suit la préférence du navigateur.", icon: "settings" },
];

export default function AppearanceSettingsPage() {
    const {
        data: profileData,
        mutate,
    } = useSWR<ProfileResponse>("/api/user/profile", fetcher, {
        revalidateOnFocus: false,
    });
    const { density, setDensity, isFocusMode, toggleFocusMode } = useSidebar();
    const [saved, setSaved] = useState(false);

    const selectedMode = useMemo<DisplayMode>(
        () => (isFocusMode ? "focus" : density),
        [density, isFocusMode]
    );

    const selectedTheme = useMemo<ThemeValue>(() => {
        const appearance =
            profileData?.preferences?.appearance &&
            typeof profileData.preferences.appearance === "object"
                ? (profileData.preferences.appearance as Record<string, unknown>)
                : null;
        const serverTheme = appearance?.theme;
        return serverTheme === "light" || serverTheme === "dark" || serverTheme === "system"
            ? serverTheme
            : "system";
    }, [profileData]);

    useEffect(() => {
        applyTheme(selectedTheme);
    }, [selectedTheme]);

    const persistPreferences = async (partialAppearance: Record<string, unknown>) => {
        const currentPreferences =
            profileData?.preferences && typeof profileData.preferences === "object"
                ? profileData.preferences
                : {};
        const currentAppearance =
            currentPreferences.appearance && typeof currentPreferences.appearance === "object"
                ? currentPreferences.appearance
                : {};
        const nextPreferences = {
            ...currentPreferences,
            appearance: {
                ...currentAppearance,
                ...partialAppearance,
            },
        };

        await fetch("/api/user/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ preferences: nextPreferences }),
        });

        await mutate({ ...(profileData || {}), preferences: nextPreferences }, false);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 2200);
    };

    const handleThemeChange = async (nextTheme: ThemeValue) => {
        applyTheme(nextTheme);
        await persistPreferences({ theme: nextTheme });
    };

    const handleDisplayModeChange = async (mode: DisplayMode) => {
        if (mode === "focus") {
            if (!isFocusMode) toggleFocusMode();
            await persistPreferences({ density, focusMode: true, displayMode: "focus" });
            return;
        }
        if (isFocusMode) toggleFocusMode();
        setDensity(mode);
        await persistPreferences({ density: mode, focusMode: false, displayMode: mode });
    };

    return (
        <PageGuard roles={AUTHENTICATED_DASHBOARD_ROLES}>
            <div className="eduflow-scope mx-auto flex max-w-5xl flex-col gap-6 pb-12">
                <PageHeader
                    greeting="Apparence & affichage"
                    sub="Contrôle le rendu visuel, la densité et le mode focus de ton espace EduPilot."
                />

                {saved ? (
                    <Card
                        padding={14}
                        style={{
                            borderLeft: "3px solid var(--eduflow-success-500)",
                            background: "var(--eduflow-success-50)",
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <Icon name="success" size={18} color="var(--eduflow-success-700)" />
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 13,
                                    color: "var(--eduflow-success-800)",
                                    fontWeight: 500,
                                }}
                            >
                                Préférences enregistrées sur ce navigateur et sur ton profil.
                            </p>
                        </div>
                    </Card>
                ) : null}

                {/* Display modes */}
                <Card padding={0}>
                    <div
                        className="flex items-center gap-2 border-b px-5 py-4"
                        style={{ borderColor: "var(--eduflow-border-subtle)" }}
                    >
                        <Icon name="cards" size={18} color="var(--brand-700)" />
                        <div>
                            <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                Modes d&apos;affichage
                            </h3>
                            <p
                                style={{
                                    margin: "2px 0 0",
                                    fontSize: 11,
                                    color: "var(--eduflow-text-tertiary)",
                                }}
                            >
                                Confort = lisibilité · Dense = densité · Focus = concentration
                            </p>
                        </div>
                    </div>
                    <div
                        className="grid gap-3 px-5 py-5"
                        style={{
                            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        }}
                    >
                        {DISPLAY_MODES.map((option) => {
                            const isActive = selectedMode === option.id;
                            return (
                                <ChoiceTile
                                    key={option.id}
                                    title={option.title}
                                    description={option.description}
                                    icon={option.icon}
                                    active={isActive}
                                    onClick={() => void handleDisplayModeChange(option.id)}
                                />
                            );
                        })}
                    </div>
                </Card>

                {/* Theme */}
                <Card padding={0}>
                    <div
                        className="flex items-center gap-2 border-b px-5 py-4"
                        style={{ borderColor: "var(--eduflow-border-subtle)" }}
                    >
                        <Icon name="settings" size={18} color="var(--brand-700)" />
                        <div>
                            <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                Thème
                            </h3>
                            <p
                                style={{
                                    margin: "2px 0 0",
                                    fontSize: 11,
                                    color: "var(--eduflow-text-tertiary)",
                                }}
                            >
                                Conservé dans tes préférences utilisateur et appliqué immédiatement.
                            </p>
                        </div>
                    </div>
                    <div
                        className="grid gap-3 px-5 py-5"
                        style={{
                            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        }}
                    >
                        {THEMES.map((option) => {
                            const isActive = selectedTheme === option.id;
                            return (
                                <ChoiceTile
                                    key={option.id}
                                    title={option.title}
                                    description={option.description}
                                    icon={option.icon}
                                    active={isActive}
                                    onClick={() => void handleThemeChange(option.id)}
                                />
                            );
                        })}
                    </div>
                </Card>
            </div>
        </PageGuard>
    );
}

function ChoiceTile({
    title,
    description,
    icon,
    active,
    onClick,
}: {
    title: string;
    description: string;
    icon: IconName;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="text-left"
            style={{
                padding: 16,
                borderRadius: "var(--eduflow-radius-card)",
                border: active
                    ? "2px solid var(--brand-600)"
                    : "1px solid var(--eduflow-border-default)",
                background: active
                    ? "var(--brand-50)"
                    : "var(--eduflow-surface-card)",
                cursor: "pointer",
                fontFamily: "inherit",
                transition:
                    "all var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                boxShadow: active ? "var(--eduflow-shadow-card-brand)" : "none",
            }}
        >
            <div className="mb-3 flex items-center justify-between">
                <div
                    className="grid place-items-center"
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: active
                            ? "var(--brand-100)"
                            : "var(--eduflow-surface-sunken)",
                        color: active ? "var(--brand-700)" : "var(--eduflow-text-secondary)",
                    }}
                >
                    <Icon name={icon} size={18} />
                </div>
                {active ? (
                    <Badge variant="brand" size="sm" icon="check">
                        Actif
                    </Badge>
                ) : null}
            </div>
            <div
                style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: active ? "var(--brand-800)" : "var(--eduflow-text-primary)",
                }}
            >
                {title}
            </div>
            <p
                style={{
                    margin: "6px 0 0",
                    fontSize: 12,
                    color: "var(--eduflow-text-secondary)",
                    lineHeight: 1.5,
                }}
            >
                {description}
            </p>
        </button>
    );
}
