"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useDeviceCapabilities, DeviceCapabilities } from "@/lib/hooks/use-device-capabilities";

interface LiteModeContextValue {
    /** Is Lite Mode currently enabled */
    isLiteMode: boolean;
    /** Toggle Lite Mode manually */
    toggleLiteMode: () => void;
    /** Force enable Lite Mode */
    enableLiteMode: () => void;
    /** Force disable Lite Mode */
    disableLiteMode: () => void;
    /** Was Lite Mode auto-enabled */
    autoEnabled: boolean;
    /** Device capabilities info */
    capabilities: DeviceCapabilities;
}

const LiteModeContext = createContext<LiteModeContextValue | undefined>(undefined);

const LITE_MODE_STORAGE_KEY = "edupilot-lite-mode";

interface LiteModeProviderProps {
    children: ReactNode;
    /** Force Lite Mode regardless of detection */
    forceLiteMode?: boolean;
}

/**
 * Provider for Lite Mode functionality.
 * Automatically enables Lite Mode for:
 * - Slow connections (2G, 3G, slow-2g)
 * - Low-end devices (<4GB RAM, <4 CPU cores)
 * - Data saver mode enabled
 * 
 * Can also be toggled manually by user.
 */
export function LiteModeProvider({ children, forceLiteMode = false }: LiteModeProviderProps) {
    const capabilities = useDeviceCapabilities();
    const [isLiteMode, setIsLiteMode] = useState(forceLiteMode);
    const [autoEnabled, setAutoEnabled] = useState(false);
    const [userOverride, setUserOverride] = useState<boolean | null>(null);

    // Check localStorage for user preference
    useEffect(() => {
        if (typeof window === "undefined") return;

        const stored = localStorage.getItem(LITE_MODE_STORAGE_KEY);
        if (stored !== null) {
            setUserOverride(stored === "true");
        }
    }, []);

    // Auto-enable based on capabilities
    useEffect(() => {
        if (forceLiteMode) {
            setIsLiteMode(true);
            return;
        }

        // If user has explicitly set a preference, use that
        if (userOverride !== null) {
            setIsLiteMode(userOverride);
            return;
        }

        // Otherwise, auto-enable based on device capabilities
        if (capabilities.shouldEnableLiteMode) {
            setIsLiteMode(true);
            setAutoEnabled(true);
        }
    }, [capabilities.shouldEnableLiteMode, userOverride, forceLiteMode]);

    // Apply CSS class to document for global styling
    useEffect(() => {
        if (typeof document === "undefined") return;

        if (isLiteMode) {
            document.documentElement.classList.add("lite-mode");
            document.documentElement.setAttribute("data-lite-mode", "true");
        } else {
            document.documentElement.classList.remove("lite-mode");
            document.documentElement.removeAttribute("data-lite-mode");
        }
    }, [isLiteMode]);

    const toggleLiteMode = useCallback(() => {
        setIsLiteMode((prev) => {
            const newValue = !prev;
            localStorage.setItem(LITE_MODE_STORAGE_KEY, String(newValue));
            setUserOverride(newValue);
            return newValue;
        });
    }, []);

    const enableLiteMode = useCallback(() => {
        setIsLiteMode(true);
        localStorage.setItem(LITE_MODE_STORAGE_KEY, "true");
        setUserOverride(true);
    }, []);

    const disableLiteMode = useCallback(() => {
        setIsLiteMode(false);
        localStorage.setItem(LITE_MODE_STORAGE_KEY, "false");
        setUserOverride(false);
    }, []);

    return (
        <LiteModeContext.Provider
            value={{
                isLiteMode,
                toggleLiteMode,
                enableLiteMode,
                disableLiteMode,
                autoEnabled,
                capabilities,
            }}
        >
            {children}
        </LiteModeContext.Provider>
    );
}

/**
 * Hook to access Lite Mode state and controls.
 */
export function useLiteMode(): LiteModeContextValue {
    const context = useContext(LiteModeContext);
    if (context === undefined) {
        throw new Error("useLiteMode must be used within a LiteModeProvider");
    }
    return context;
}

/**
 * Hook to conditionally render based on Lite Mode.
 * Returns the lite version if in Lite Mode, otherwise the full version.
 */
export function useLiteModeValue<T>(fullValue: T, liteValue: T): T {
    const { isLiteMode } = useLiteMode();
    return isLiteMode ? liteValue : fullValue;
}

export default LiteModeProvider;
