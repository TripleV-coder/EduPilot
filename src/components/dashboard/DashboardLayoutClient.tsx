"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Minimize2 } from "lucide-react";
import useSWR from "swr";

import { usePathname } from "next/navigation";
import { fetcher } from "@/lib/fetcher";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { DashboardFooter } from "@/components/dashboard/DashboardFooter";

type SidebarContextType = {
    isOpen: boolean;
    toggle: () => void;
    setIsOpen: (isOpen: boolean) => void;
    isMobileOpen: boolean;
    setIsMobileOpen: (isOpen: boolean) => void;
    density: "comfort" | "dense";
    setDensity: (density: "comfort" | "dense") => void;
    isFocusMode: boolean;
    toggleFocusMode: () => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);
export const SIDEBAR_EXPANDED_WIDTH = 220;
export const SIDEBAR_COLLAPSED_WIDTH = 56;

function readSidebarOpen(): boolean {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("edupilot-sidebar");
    return saved === null ? true : saved === "true";
}

export function useSidebar() {
    const context = useContext(SidebarContext);
    if (!context) throw new Error("useSidebar must be used within DashboardLayoutClient");
    return context;
}

export function DashboardLayoutClient({
    sidebar,
    header,
    children,
}: {
    sidebar: React.ReactNode;
    header: React.ReactNode;
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const mainRef = useRef<HTMLElement | null>(null);
    const isFirstRouteRef = useRef(true);
    const hasLoadedPreferencesRef = useRef(false);

    const [isOpen, setIsOpen] = useState(readSidebarOpen);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [density, setDensity] = useState<"comfort" | "dense">("comfort");
    const [isFocusMode, setIsFocusMode] = useState(false);
    const { data: profileData, mutate: mutateProfile } = useSWR("/api/user/profile", fetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 60000,
    });

    const persistAppearancePreferences = async (nextDensity: "comfort" | "dense", nextFocusMode: boolean) => {
        localStorage.setItem("edupilot-density", nextDensity);
        localStorage.setItem("edupilot-focus-mode", String(nextFocusMode));

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
                density: nextDensity,
                focusMode: nextFocusMode,
                displayMode: nextFocusMode ? "focus" : nextDensity,
            },
        };

        if (profileData) {
            void mutateProfile({ ...profileData, preferences: nextPreferences }, false);
        }

        try {
            await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ preferences: nextPreferences }),
            });
            void mutateProfile();
        } catch {
            // Keep the local preference even if server persistence fails.
        }
    };

    useEffect(() => {
        const savedDensity = localStorage.getItem("edupilot-density");
        if (savedDensity === "dense" || savedDensity === "comfort") {
            setDensity(savedDensity as "comfort" | "dense");
        }

        const savedFocus = localStorage.getItem("edupilot-focus-mode");
        if (savedFocus !== null) {
            setIsFocusMode(savedFocus === "true");
        }
    }, []);

    useEffect(() => {
        if (hasLoadedPreferencesRef.current) return;
        if (profileData === undefined) return;
        const appearance =
            profileData?.preferences?.appearance &&
            typeof profileData.preferences.appearance === "object"
                ? profileData.preferences.appearance
                : null;
        if (!appearance) {
            hasLoadedPreferencesRef.current = true;
            return;
        }

        const savedDensity = localStorage.getItem("edupilot-density");
        const savedFocus = localStorage.getItem("edupilot-focus-mode");

        if (!savedDensity && (appearance.density === "comfort" || appearance.density === "dense")) {
            localStorage.setItem("edupilot-density", appearance.density);
        }

        if (!savedFocus && typeof appearance.focusMode === "boolean") {
            localStorage.setItem("edupilot-focus-mode", String(appearance.focusMode));
        }

        hasLoadedPreferencesRef.current = true;
    }, [profileData]);

    const toggle = () => {
        setIsOpen((prev) => {
            const next = !prev;
            localStorage.setItem("edupilot-sidebar", String(next));
            return next;
        });
    };

    const toggleFocusMode = () => {
        setIsFocusMode((prev) => {
            const next = !prev;
            void persistAppearancePreferences(density, next);
            return next;
        });
    };

    const setDensityMode = (next: "comfort" | "dense") => {
        setDensity(next);
        setIsFocusMode(false);
        void persistAppearancePreferences(next, false);
    };

    const contextValue = useMemo(
        () => ({
            isOpen,
            toggle,
            setIsOpen,
            isMobileOpen,
            setIsMobileOpen,
            density,
            setDensity: setDensityMode,
            isFocusMode,
            toggleFocusMode,
        }),
        [isOpen, isMobileOpen, density, isFocusMode]
    );

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "f") {
                event.preventDefault();
                setIsFocusMode((prev) => {
                    const next = !prev;
                    void persistAppearancePreferences(density, next);
                    return next;
                });
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [density]);

    useEffect(() => {
        setIsMobileOpen(false);
        // Accessibilité : au changement de route (hors montage initial), ramener
        // le focus sur le contenu principal pour que les lecteurs d'écran
        // annoncent la nouvelle page. preventScroll évite tout saut visuel.
        if (isFirstRouteRef.current) {
            isFirstRouteRef.current = false;
            return;
        }
        mainRef.current?.focus({ preventScroll: true });
    }, [pathname]);

    return (
        <SidebarContext.Provider value={contextValue}>
            <div
                className={cn(
                    "relative isolate min-h-screen flex w-full overflow-hidden text-foreground bg-background",
                    density === "dense" ? "ui-density-dense" : "ui-density-comfort",
                    isFocusMode && "ui-focus-mode"
                )}
            >
                <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden print:hidden">
                    <div className="absolute -top-48 left-[18%] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,_hsl(var(--primary)/0.12)_0%,_transparent_70%)] blur-3xl" />
                    <div className="absolute bottom-[-18rem] right-[-8rem] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,_hsl(var(--secondary)/0.10)_0%,_transparent_72%)] blur-3xl" />
                </div>
                {!isFocusMode && <div className="contents print:hidden">{sidebar}</div>}
                <div
                    className={cn(
                        "flex-1 flex flex-col min-h-screen w-full transition-[margin-left] duration-300 relative bg-muted/10 print:ml-0 print:bg-white",
                        !isFocusMode && (isOpen ? "md:ml-[220px]" : "md:ml-[56px]"),
                        isFocusMode && "md:ml-0"
                    )}
                >
                    {!isFocusMode && <div className="contents print:hidden">{header}</div>}
                        {isFocusMode && (
                            <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top-4 fade-in duration-500">
                                <button
                                    onClick={toggleFocusMode}
                                    className="flex items-center gap-2 bg-card/80 hover:bg-card border border-border/50 text-foreground px-4 py-2 rounded-full shadow-lg backdrop-blur-md text-xs font-bold transition-all hover:scale-105 group"
                                >
                                    <Minimize2 className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                    Quitter le mode focus
                                </button>
                            </div>
                        )}
                        <main
                            ref={mainRef}
                            id="main-content"
                            role="main"
                            tabIndex={-1}
                            aria-label="Contenu principal"
                            className={cn(
                                "dashboard-motion flex-1 overflow-y-auto w-full custom-scrollbar focus:outline-none print:overflow-visible print:p-0",
                                density === "dense" ? "p-3 md:p-4" : "p-4 md:p-8"
                            )}
                        >
                            {children}
                        </main>
                        <div className="contents print:hidden">
                            <DashboardFooter />
                        </div>
                </div>
                <div className="contents print:hidden">
                    <OnboardingChecklist />
                </div>
            </div>
        </SidebarContext.Provider>
    );
}
