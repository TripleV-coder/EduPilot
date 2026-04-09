"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Minimize2 } from "lucide-react";
import useSWR from "swr";

import { usePathname } from "next/navigation";
import { fetcher } from "@/lib/fetcher";

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
    const shellRef = useRef<HTMLDivElement | null>(null);
    const bgTopRef = useRef<HTMLDivElement | null>(null);
    const bgBottomRef = useRef<HTMLDivElement | null>(null);
    const hasLoadedPreferencesRef = useRef(false);

    const [isOpen, setIsOpen] = useState(true);
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
        const frame = window.requestAnimationFrame(() => {
            const savedOpen = localStorage.getItem("edupilot-sidebar");
            if (savedOpen !== null) {
                setIsOpen(savedOpen === "true");
            }

            const savedDensity = localStorage.getItem("edupilot-density");
            if (savedDensity === "dense" || savedDensity === "comfort") {
                setDensity(savedDensity as "comfort" | "dense");
            }

            const savedFocus = localStorage.getItem("edupilot-focus-mode");
            if (savedFocus !== null) {
                setIsFocusMode(savedFocus === "true");
            }
        });

        return () => window.cancelAnimationFrame(frame);
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
            setDensity(appearance.density);
            localStorage.setItem("edupilot-density", appearance.density);
        }

        if (!savedFocus && typeof appearance.focusMode === "boolean") {
            setIsFocusMode(appearance.focusMode);
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

    const contextValue = {
        isOpen,
        toggle,
        setIsOpen,
        isMobileOpen,
        setIsMobileOpen,
        density,
        setDensity: setDensityMode,
        isFocusMode,
        toggleFocusMode,
    };

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
    }, []);

    useEffect(() => {
        const root = mainRef.current;
        if (!root) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const selector = [
            "[data-reveal]",
            ".reveal-on-scroll",
            ".dashboard-block",
            ".dashboard-panel",
            ".card-interactive",
            ".table-shell",
        ].join(", ");

        const prepare = (el: HTMLElement, index: number) => {
            if (el.dataset.motionReady === "1") return;
            el.dataset.motionReady = "1";
            el.style.opacity = "0";
            el.style.transform = "translate3d(0, 14px, 0) scale(0.985)";
            el.style.willChange = "transform, opacity";
            el.style.transition = "opacity 420ms cubic-bezier(0.16,1,0.3,1), transform 420ms cubic-bezier(0.16,1,0.3,1)";
            el.style.transitionDelay = `${Math.min(index * 16, 180)}ms`;
        };

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    const el = entry.target as HTMLElement;
                    el.style.opacity = "1";
                    el.style.transform = "translate3d(0, 0, 0) scale(1)";
                    observer.unobserve(el);
                });
            },
            { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
        );

        const scan = () => {
            const items = Array.from(root.querySelectorAll<HTMLElement>(selector));
            items.forEach((el, i) => {
                prepare(el, i);
                observer.observe(el);
            });
        };

        scan();
        const mutationObserver = new MutationObserver(scan);
        mutationObserver.observe(root, { childList: true, subtree: true });

        return () => {
            observer.disconnect();
            mutationObserver.disconnect();
        };
    }, [pathname]);

    useEffect(() => {
        const top = bgTopRef.current;
        const bottom = bgBottomRef.current;
        const shell = shellRef.current;
        if (!top || !bottom || !shell) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        let frame = 0;
        const update = () => {
            const y = window.scrollY || 0;
            top.style.transform = `translate3d(0, ${Math.min(36, y * 0.05)}px, 0)`;
            bottom.style.transform = `translate3d(0, ${Math.max(-30, -y * 0.028)}px, 0)`;
            shell.style.setProperty("--dash-scroll-progress", `${Math.min(1, y / Math.max(1, window.innerHeight))}`);
            frame = 0;
        };
        const onScroll = () => {
            if (frame) return;
            frame = window.requestAnimationFrame(update);
        };
        update();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            if (frame) window.cancelAnimationFrame(frame);
            window.removeEventListener("scroll", onScroll);
        };
    }, [pathname]);

    useEffect(() => {
        const main = mainRef.current;
        if (!main) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        main.animate(
            [
                { opacity: 0.8, transform: "translate3d(0, 10px, 0)" },
                { opacity: 1, transform: "translate3d(0, 0, 0)" },
            ],
            { duration: 260, easing: "cubic-bezier(0.16,1,0.3,1)" }
        );
    }, [pathname]);

    useEffect(() => {
        const main = mainRef.current;
        if (!main) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        main.animate(
            [
                { opacity: 0.8, transform: "translate3d(0, 10px, 0)" },
                { opacity: 1, transform: "translate3d(0, 0, 0)" },
            ],
            { duration: 260, easing: "cubic-bezier(0.16,1,0.3,1)" }
        );
    }, [pathname]);

    return (
        <SidebarContext.Provider value={contextValue}>
            <div
                ref={shellRef}
                className={cn(
                    "relative isolate min-h-screen flex w-full overflow-hidden text-foreground",
                    "bg-background",
                    density === "dense" ? "ui-density-dense" : "ui-density-comfort",
                    isFocusMode && "ui-focus-mode"
                )}
            >
                <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                    <div ref={bgTopRef} className="absolute -top-48 left-[18%] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,_hsl(var(--primary)/0.18)_0%,_transparent_70%)] blur-3xl transition-transform duration-200" />
                    <div ref={bgBottomRef} className="absolute bottom-[-18rem] right-[-8rem] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,_hsl(var(--secondary)/0.16)_0%,_transparent_72%)] blur-3xl transition-transform duration-200" />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,_hsl(var(--background))_0%,_hsl(var(--background))_62%,_hsl(var(--muted)/0.32)_100%)]" />
                </div>
                {!isFocusMode && sidebar}
                <div className={cn(
                    "flex-1 flex flex-col min-h-screen w-full transition-all duration-300 relative",
                    !isFocusMode && (isOpen ? "md:ml-[220px]" : "md:ml-[56px]"),
                    isFocusMode && "md:ml-0",
                    "bg-muted/10"
                )}>
                    {!isFocusMode && header}
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
                        className={cn(
                            "dashboard-motion flex-1 overflow-y-auto w-full custom-scrollbar",
                            density === "dense" ? "p-3 md:p-4" : "p-4 md:p-8"
                        )}
                    >
                        {children}
                    </main>
                </div>
            </div>
        </SidebarContext.Provider>
    );
}
