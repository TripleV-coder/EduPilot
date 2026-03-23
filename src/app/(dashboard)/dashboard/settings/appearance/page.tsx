"use client";

import { useEffect, useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { Palette, Layout, Moon, Sun, Monitor, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

type ThemeValue = "light" | "dark" | "system";

function applyTheme(theme: ThemeValue) {
    const root = document.documentElement;
    if (theme === "dark") {
        root.classList.add("dark");
    } else if (theme === "light") {
        root.classList.remove("dark");
    } else {
        // System preference
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (prefersDark) {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
    }
}

export default function AppearanceSettingsPage() {
    const { data: profileData, mutate } = useSWR("/api/user/profile", fetcher);

    const [theme, setTheme] = useState<ThemeValue>("system");
    const [saved, setSaved] = useState(false);

    // Load saved theme from profile
    useEffect(() => {
        if (profileData?.preferences?.theme) {
            const savedTheme = profileData.preferences.theme as ThemeValue;
            if (["light", "dark", "system"].includes(savedTheme)) {
                queueMicrotask(() => {
                    setTheme(savedTheme);
                    applyTheme(savedTheme);
                });
            }
        }
    }, [profileData]);

    const handleThemeChange = async (newTheme: ThemeValue) => {
        setTheme(newTheme);
        applyTheme(newTheme);

        try {
            const currentPrefs = profileData?.preferences || {};
            const updatedPrefs = { ...currentPrefs, theme: newTheme };

            await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ preferences: updatedPrefs }),
            });

            mutate({ ...profileData, preferences: updatedPrefs }, false);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (error) {
            console.error("Failed to save theme:", error);
        }
    };

    return (
        <PageGuard permission={["*" as Permission] /* Accessible by everyone */}>
            <div className="space-y-6 max-w-4xl mx-auto">
                <PageHeader
                    title="Apparence & Thème"
                    description="Personnalisez l'interface de l'application selon vos préférences visuelles."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Paramètres", href: "/dashboard/settings" },
                        { label: "Apparence" },
                    ]}
                />

                {saved && (
                    <div className="p-3 rounded-lg bg-[hsl(var(--success-bg))] border border-[hsl(var(--success-border))] text-[hsl(var(--success))] flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4" /> Thème enregistré avec succès.
                    </div>
                )}

                <div className="grid gap-6">
                    <Card className="border-border shadow-sm">
                        <CardHeader className="bg-muted/10 border-b border-border">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Palette className="w-5 h-5 text-primary" />
                                Mode d&apos;Affichage
                            </CardTitle>
                            <CardDescription>
                                Choisissez entre le thème clair, sombre, ou laissez le système décider.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <button
                                onClick={() => handleThemeChange("light")}
                                className={`p-4 border-2 rounded-xl flex flex-col items-center gap-3 transition-all ${theme === 'light' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'}`}
                            >
                                <div className="p-3 bg-background border border-border shadow-sm rounded-full">
                                    <Sun className="w-6 h-6 text-primary" />
                                </div>
                                <span className="font-medium">Clair</span>
                            </button>

                            <button
                                onClick={() => handleThemeChange("dark")}
                                className={`p-4 border-2 rounded-xl flex flex-col items-center gap-3 transition-all ${theme === 'dark' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'}`}
                            >
                                <div className="p-3 bg-muted/50 border border-border shadow-sm rounded-full">
                                    <Moon className="w-6 h-6 text-muted-foreground" />
                                </div>
                                <span className="font-medium">Sombre</span>
                            </button>

                            <button
                                onClick={() => handleThemeChange("system")}
                                className={`p-4 border-2 rounded-xl flex flex-col items-center gap-3 transition-all ${theme === 'system' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'}`}
                            >
                                <div className="p-3 bg-gradient-to-r from-background/70 to-muted/30 border border-border shadow-sm rounded-full flex items-center justify-center">
                                    <Monitor className="w-6 h-6 text-secondary" />
                                </div>
                                <span className="font-medium">Système</span>
                            </button>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-sm">
                        <CardHeader className="bg-muted/10 border-b border-border">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Layout className="w-5 h-5 text-primary" />
                                Densité de l&apos;interface
                            </CardTitle>
                            <CardDescription>
                                Ajustez l&apos;espacement et la taille des éléments (tableaux, listes, etc.).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 flex flex-col sm:flex-row gap-4">
                            <Button variant="outline" className="flex-1 justify-center py-8 border-border">
                                <span className="flex flex-col items-center">
                                    <span className="text-base font-semibold mb-1">Standard</span>
                                    <span className="text-xs text-muted-foreground font-normal">Idéal pour les écrans tactiles</span>
                                </span>
                            </Button>
                            <Button variant="outline" className="flex-1 justify-center py-8 border-primary bg-primary/5 text-primary">
                                <span className="flex flex-col items-center">
                                    <span className="text-base font-semibold mb-1">Compact</span>
                                    <span className="text-xs text-muted-foreground opacity-80 font-normal">Affiche plus de données à l&apos;écran</span>
                                </span>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </PageGuard>
    );
}
