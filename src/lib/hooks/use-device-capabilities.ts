"use client";

import { useState, useEffect, useCallback } from "react";

export interface DeviceCapabilities {
    /** Connection type: 4g, 3g, 2g, slow-2g */
    connectionType: string | null;
    /** Effective connection speed */
    effectiveType: "4g" | "3g" | "2g" | "slow-2g" | null;
    /** Device memory in GB (if available) */
    deviceMemory: number | null;
    /** Number of logical CPU cores */
    hardwareConcurrency: number;
    /** Is data saver mode enabled */
    saveData: boolean;
    /** Is this considered a low-end device */
    isLowEndDevice: boolean;
    /** Is this a slow connection */
    isSlowConnection: boolean;
    /** Should we enable lite mode automatically */
    shouldEnableLiteMode: boolean;
    /** Is online */
    isOnline: boolean;
    /** Downlink speed in Mbps */
    downlink: number | null;
    /** Round-trip time in ms */
    rtt: number | null;
}

interface NetworkInformation extends EventTarget {
    effectiveType: "4g" | "3g" | "2g" | "slow-2g";
    type?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
    addEventListener(type: string, listener: EventListener): void;
    removeEventListener(type: string, listener: EventListener): void;
}

declare global {
    interface Navigator {
        connection?: NetworkInformation;
        mozConnection?: NetworkInformation;
        webkitConnection?: NetworkInformation;
        deviceMemory?: number;
    }
}

const getConnection = (): NetworkInformation | null => {
    if (typeof navigator === "undefined") return null;
    return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
};

const DEFAULT_CAPABILITIES: DeviceCapabilities = {
    connectionType: null,
    effectiveType: null,
    deviceMemory: null,
    hardwareConcurrency: 4,
    saveData: false,
    isLowEndDevice: false,
    isSlowConnection: false,
    shouldEnableLiteMode: false,
    isOnline: true,
    downlink: null,
    rtt: null,
};

/**
 * Hook to detect device capabilities and network conditions.
 * Used to automatically enable Lite Mode for low-end devices or slow connections.
 */
export function useDeviceCapabilities(): DeviceCapabilities {
    const [capabilities, setCapabilities] = useState<DeviceCapabilities>(DEFAULT_CAPABILITIES);

    const updateCapabilities = useCallback(() => {
        if (typeof window === "undefined") return;

        const connection = getConnection();
        const deviceMemory = navigator.deviceMemory || null;
        const hardwareConcurrency = navigator.hardwareConcurrency || 4;

        // Connection analysis
        const effectiveType = connection?.effectiveType || null;
        const connectionType = connection?.type || null;
        const downlink = connection?.downlink || null;
        const rtt = connection?.rtt || null;
        const saveData = connection?.saveData || false;

        // Determine if slow connection
        const slowConnectionTypes: Array<"2g" | "3g" | "slow-2g"> = ["2g", "slow-2g", "3g"];
        const isSlowConnection = effectiveType
            ? slowConnectionTypes.includes(effectiveType as "2g" | "3g" | "slow-2g")
            : (rtt !== null && rtt > 500) || (downlink !== null && downlink < 1);

        // Determine if low-end device
        const isLowEndDevice =
            (deviceMemory !== null && deviceMemory < 4) ||
            hardwareConcurrency < 4;

        // Should enable lite mode
        const shouldEnableLiteMode = isSlowConnection || isLowEndDevice || saveData;

        setCapabilities({
            connectionType,
            effectiveType,
            deviceMemory,
            hardwareConcurrency,
            saveData,
            isLowEndDevice,
            isSlowConnection,
            shouldEnableLiteMode,
            isOnline: navigator.onLine,
            downlink,
            rtt,
        });
    }, []);

    useEffect(() => {
        updateCapabilities();

        const connection = getConnection();

        // Listen to connection changes
        if (connection) {
            connection.addEventListener("change", updateCapabilities);
        }

        // Listen to online/offline
        window.addEventListener("online", updateCapabilities);
        window.addEventListener("offline", updateCapabilities);

        return () => {
            if (connection) {
                connection.removeEventListener("change", updateCapabilities);
            }
            window.removeEventListener("online", updateCapabilities);
            window.removeEventListener("offline", updateCapabilities);
        };
    }, [updateCapabilities]);

    return capabilities;
}

export default useDeviceCapabilities;
