"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface SidebarContextValue {
    /** Is sidebar collapsed (icons only) */
    isCollapsed: boolean;
    /** Is sidebar open on mobile (overlay) */
    isMobileOpen: boolean;
    /** Toggle collapsed state */
    toggleCollapsed: () => void;
    /** Set collapsed state */
    setCollapsed: (collapsed: boolean) => void;
    /** Toggle mobile sidebar */
    toggleMobile: () => void;
    /** Close mobile sidebar */
    closeMobile: () => void;
    /** Open mobile sidebar */
    openMobile: () => void;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

const SIDEBAR_COLLAPSED_KEY = "edupilot-sidebar-collapsed";

interface SidebarProviderProps {
    children: ReactNode;
    defaultCollapsed?: boolean;
}

/**
 * Provider for global sidebar state management.
 * Handles both desktop collapsed state and mobile overlay state.
 */
export function SidebarProvider({ children, defaultCollapsed = false }: SidebarProviderProps) {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    // Load collapsed state from localStorage
    useEffect(() => {
        if (typeof window === "undefined") return;

        const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
        if (stored !== null) {
            setIsCollapsed(stored === "true");
        }
    }, []);

    // Close mobile sidebar on route change or escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsMobileOpen(false);
            }
        };

        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, []);

    const toggleCollapsed = useCallback(() => {
        setIsCollapsed((prev) => {
            const newValue = !prev;
            localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newValue));
            return newValue;
        });
    }, []);

    const setCollapsed = useCallback((collapsed: boolean) => {
        setIsCollapsed(collapsed);
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    }, []);

    const toggleMobile = useCallback(() => {
        setIsMobileOpen((prev) => !prev);
    }, []);

    const closeMobile = useCallback(() => {
        setIsMobileOpen(false);
    }, []);

    const openMobile = useCallback(() => {
        setIsMobileOpen(true);
    }, []);

    return (
        <SidebarContext.Provider
            value= {{
        isCollapsed,
            isMobileOpen,
            toggleCollapsed,
            setCollapsed,
            toggleMobile,
            closeMobile,
            openMobile,
            }
}
        >
    { children }
    </SidebarContext.Provider>
    );
}

/**
 * Hook to access sidebar state and controls.
 */
export function useSidebar(): SidebarContextValue {
    const context = useContext(SidebarContext);
    if (context === undefined) {
        throw new Error("useSidebar must be used within a SidebarProvider");
    }
    return context;
}

export default SidebarProvider;
