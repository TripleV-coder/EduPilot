"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// ============================================
// TYPES
// ============================================

export interface Tab {
    id: string;
    title: string;
    path: string;
    icon?: string;
    isDirty?: boolean;
    closeable?: boolean;
}

interface TabContextType {
    tabs: Tab[];
    activeTabId: string | null;
    addTab: (tab: Omit<Tab, "id">) => string;
    closeTab: (id: string) => void;
    setActiveTab: (id: string) => void;
    updateTab: (id: string, updates: Partial<Tab>) => void;
    closeAllTabs: () => void;
    closeOtherTabs: (id: string) => void;
}

// ============================================
// CONSTANTS
// ============================================

const STORAGE_KEY = "edupilot-tabs";
const MAX_TABS = 10;

// ============================================
// CONTEXT
// ============================================

const TabContext = createContext<TabContextType | null>(null);

export function useTabContext() {
    const context = useContext(TabContext);
    if (!context) {
        throw new Error("useTabContext must be used within a TabProvider");
    }
    return context;
}

// ============================================
// TITLE MAPPING
// ============================================

const pathTitleMap: Record<string, string> = {
    "/dashboard": "Vue d'ensemble",
    "/school/students": "Élèves",
    "/school/teachers": "Enseignants",
    "/school/classes": "Classes",
    "/grades": "Notes",
    "/attendance": "Présences",
    "/schedule": "Emploi du temps",
    "/payments": "Paiements",
    "/messages": "Messages",
    "/analytics": "Statistiques",
    "/settings": "Paramètres",
    "/admin": "Administration",
    "/admin/subjects": "Matières",
};

function getTitleFromPath(path: string): string {
    // Check exact match
    if (pathTitleMap[path]) return pathTitleMap[path];

    // Check prefix match for dynamic routes
    for (const [key, title] of Object.entries(pathTitleMap)) {
        if (path.startsWith(key + "/")) {
            const suffix = path.replace(key + "/", "");
            if (suffix === "new") return `Nouveau - ${title}`;
            if (suffix.includes("/edit")) return `Modifier - ${title}`;
            return title;
        }
    }

    // Fallback: capitalize last segment
    const segments = path.split("/").filter(Boolean);
    const last = segments[segments.length - 1] || "Page";
    return last.charAt(0).toUpperCase() + last.slice(1);
}

// ============================================
// PROVIDER
// ============================================

export function TabProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // Load tabs from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setTabs(parsed.tabs || []);
                setActiveTabId(parsed.activeTabId || null);
            } catch {
                // Invalid storage, start fresh
            }
        }
        setIsInitialized(true);
    }, []);

    // Persist tabs to localStorage
    useEffect(() => {
        if (isInitialized) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeTabId }));
        }
    }, [tabs, activeTabId, isInitialized]);

    // Auto-create tab for current path
    useEffect(() => {
        if (!isInitialized) return;

        const existingTab = tabs.find(t => t.path === pathname);
        if (existingTab) {
            setActiveTabId(existingTab.id);
        } else {
            // Create new tab for this path
            const newTab: Tab = {
                id: `tab-${Date.now()}`,
                title: getTitleFromPath(pathname),
                path: pathname,
                closeable: pathname !== "/dashboard",
            };

            setTabs(prev => {
                // Limit tabs
                if (prev.length >= MAX_TABS) {
                    // Remove oldest closeable tab
                    const closeableIndex = prev.findIndex(t => t.closeable);
                    if (closeableIndex >= 0) {
                        return [...prev.slice(0, closeableIndex), ...prev.slice(closeableIndex + 1), newTab];
                    }
                }
                return [...prev, newTab];
            });
            setActiveTabId(newTab.id);
        }
    }, [pathname, isInitialized]);

    const addTab = useCallback((tabData: Omit<Tab, "id">) => {
        const id = `tab-${Date.now()}`;
        const newTab: Tab = { ...tabData, id };

        setTabs(prev => {
            if (prev.length >= MAX_TABS) {
                const closeableIndex = prev.findIndex(t => t.closeable);
                if (closeableIndex >= 0) {
                    return [...prev.slice(0, closeableIndex), ...prev.slice(closeableIndex + 1), newTab];
                }
            }
            return [...prev, newTab];
        });

        return id;
    }, []);

    const closeTab = useCallback((id: string) => {
        const tabIndex = tabs.findIndex(t => t.id === id);
        const tab = tabs[tabIndex];

        if (!tab || !tab.closeable) return;

        setTabs(prev => prev.filter(t => t.id !== id));

        // If closing active tab, switch to adjacent tab
        if (activeTabId === id) {
            const remainingTabs = tabs.filter(t => t.id !== id);
            if (remainingTabs.length > 0) {
                const newIndex = Math.min(tabIndex, remainingTabs.length - 1);
                const newActiveTab = remainingTabs[newIndex];
                setActiveTabId(newActiveTab.id);
                router.push(newActiveTab.path);
            }
        }
    }, [tabs, activeTabId, router]);

    const setActiveTab = useCallback((id: string) => {
        const tab = tabs.find(t => t.id === id);
        if (tab) {
            setActiveTabId(id);
            router.push(tab.path);
        }
    }, [tabs, router]);

    const updateTab = useCallback((id: string, updates: Partial<Tab>) => {
        setTabs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    }, []);

    const closeAllTabs = useCallback(() => {
        const uncloseable = tabs.filter(t => !t.closeable);
        setTabs(uncloseable);
        if (uncloseable.length > 0) {
            setActiveTabId(uncloseable[0].id);
            router.push(uncloseable[0].path);
        }
    }, [tabs, router]);

    const closeOtherTabs = useCallback((id: string) => {
        const keepTabs = tabs.filter(t => t.id === id || !t.closeable);
        setTabs(keepTabs);
    }, [tabs]);

    return (
        <TabContext.Provider
            value={{
                tabs,
                activeTabId,
                addTab,
                closeTab,
                setActiveTab,
                updateTab,
                closeAllTabs,
                closeOtherTabs,
            }}
        >
            {children}
        </TabContext.Provider>
    );
}
