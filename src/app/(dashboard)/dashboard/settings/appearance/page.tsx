"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { CheckCircle, Eye, Layout, Monitor, Moon, PanelsTopLeft, Sun } from "lucide-react";

import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AUTHENTICATED_DASHBOARD_ROLES } from "@/lib/rbac/permissions";
import { fetcher } from "@/lib/fetcher";
import { useSidebar } from "@/components/dashboard/DashboardLayoutClient";

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

export default function AppearanceSettingsPage() {
  const { data: profileData, mutate } = useSWR<ProfileResponse>("/api/user/profile", fetcher, {
    revalidateOnFocus: false,
  });
  const { density, setDensity, isFocusMode, toggleFocusMode } = useSidebar();
  const [theme, setTheme] = useState<ThemeValue>("system");
  const [saved, setSaved] = useState(false);

  const selectedMode = useMemo<DisplayMode>(
    () => (isFocusMode ? "focus" : density),
    [density, isFocusMode]
  );

  useEffect(() => {
    const appearance =
      profileData?.preferences?.appearance &&
      typeof profileData.preferences.appearance === "object"
        ? (profileData.preferences.appearance as Record<string, unknown>)
        : null;
    const savedTheme = appearance?.theme;
    if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    }
  }, [profileData]);

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
    setTheme(nextTheme);
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
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader
          title="Apparence & Modes d'affichage"
          description="Contrôlez le rendu visuel, la densité et le mode focus de votre espace EduPilot."
          breadcrumbs={[
            { label: "Tableau de bord", href: "/dashboard" },
            { label: "Paramètres", href: "/dashboard/settings" },
            { label: "Apparence" },
          ]}
        />

        {saved ? (
          <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--success-border))] bg-[hsl(var(--success-bg))] px-4 py-3 text-sm text-[hsl(var(--success))]">
            <CheckCircle className="h-4 w-4" />
            Préférences enregistrées sur ce navigateur et sur votre profil.
          </div>
        ) : null}

        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border bg-muted/10">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Layout className="h-5 w-5 text-primary" />
              Modes d'affichage
            </CardTitle>
            <CardDescription>
              Le mode confort privilégie la lisibilité, le mode dense maximise la densité, le mode focus masque la structure secondaire.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
            {[
              {
                id: "comfort" as const,
                title: "Mode Confort",
                description: "Lignes 44px, texte 13px et espacement standard pour un usage quotidien.",
                icon: Layout,
              },
              {
                id: "dense" as const,
                title: "Mode Dense",
                description: "Lignes 32px et espacement réduit pour afficher plus de données à l'écran.",
                icon: PanelsTopLeft,
              },
              {
                id: "focus" as const,
                title: "Mode Focus",
                description: "Masque la sidebar et réduit l'interface pour concentrer l'attention sur le contenu.",
                icon: Eye,
              },
            ].map((option) => {
              const isActive = selectedMode === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => void handleDisplayModeChange(option.id)}
                  className={[
                    "rounded-2xl border p-5 text-left transition-all duration-150",
                    isActive
                      ? "border-[#2D6A4F] bg-[#EEF7F3] shadow-sm"
                      : "border-border bg-card hover:border-[#B8DFC8] hover:bg-[#FAFAF8]",
                  ].join(" ")}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F5F4F2]">
                      <option.icon className="h-5 w-5 text-[#2D6A4F]" />
                    </div>
                    {isActive ? (
                      <span className="rounded-full bg-[#2D6A4F] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
                        Actif
                      </span>
                    ) : null}
                  </div>
                  <p className="text-base font-semibold text-foreground">{option.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{option.description}</p>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border bg-muted/10">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Monitor className="h-5 w-5 text-primary" />
              Thème
            </CardTitle>
            <CardDescription>
              Le thème est conservé dans vos préférences utilisateur et appliqué immédiatement.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
            {[
              { id: "light" as const, title: "Clair", icon: Sun },
              { id: "dark" as const, title: "Sombre", icon: Moon },
              { id: "system" as const, title: "Système", icon: Monitor },
            ].map((option) => {
              const isActive = theme === option.id;

              return (
                <Button
                  key={option.id}
                  type="button"
                  variant="outline"
                  className={[
                    "h-auto min-h-[108px] flex-col items-start justify-between rounded-2xl border px-4 py-4 text-left",
                    isActive ? "border-[#2D6A4F] bg-[#EEF7F3] text-[#1A4535]" : "border-border",
                  ].join(" ")}
                  onClick={() => void handleThemeChange(option.id)}
                >
                  <option.icon className="h-5 w-5" />
                  <div>
                    <div className="font-semibold">{option.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {option.id === "system" ? "Suit la préférence du navigateur." : `Applique le thème ${option.title.toLowerCase()}.`}
                    </div>
                  </div>
                </Button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </PageGuard>
  );
}
