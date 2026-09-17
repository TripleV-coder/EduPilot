"use client";

import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/utils/error-message";

/**
 * État du système pour le super-administrateur (Lot 7) — chargement seul.
 * La présentation reste dans la page (règle 9).
 */
export interface RecentError {
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    createdAt: string;
    userId: string | null;
    user: { email: string | null; firstName: string | null; lastName: string | null } | null;
}

export interface MonitoringData {
    timestamp: string;
    database: {
        health: { responseTime: number; status: string };
        connectionPool: { status: string };
    };
    cache: {
        connected: boolean;
        hitRate: number;
        memory: string | null;
    };
    /** Machine : mémoire, disque, dernière sauvegarde vérifiée. */
    host: {
        memory: { rssMb: number; heapUsedMb: number; totalMb: number; freeMb: number; usedPercent: number };
        disk: { totalGb: number; freeGb: number; usedPercent: number } | null;
        backup: {
            status: "ok" | "stale" | "none" | "unavailable";
            lastSuccessAt: string | null;
            ageHours: number | null;
            sizeBytes: number | null;
            archives: number;
            rowCount: number | null;
        };
        uptimeSeconds: number;
        nodeVersion: string;
    };
    system: {
        maintenanceMode: boolean;
        activeSessions: number;
        recentLogins: number;
        pendingDataRequests: number;
    };
    errors: {
        last24h: number;
        recent: RecentError[];
        byType: { type: string; count: number }[];
    };
    alerts: {
        level: string;
        message: string;
        timestamp: string;
    }[];
}

export function useRootMonitoring() {
    const [data, setData] = useState<MonitoringData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setError(null);
            const res = await fetch("/api/root/monitoring", { credentials: "include", cache: "no-store" });
            if (!res.ok) throw new Error("Erreur serveur");
            setData((await res.json()) as MonitoringData);
        } catch (e) {
            setError(getErrorMessage(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    return { data, loading, error, reload: load };
}

/** « il y a 3 h », « il y a 2 j » — âge de la dernière sauvegarde. */
export function formatAge(hours: number | null): string {
    if (hours === null) return "—";
    if (hours < 1) return "il y a moins d'une heure";
    if (hours < 48) return `il y a ${Math.round(hours)} h`;
    return `il y a ${Math.round(hours / 24)} j`;
}

/** Taille lisible d'une archive de sauvegarde. */
export function formatBytes(bytes: number | null): string {
    if (bytes === null) return "—";
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} Go`;
}
