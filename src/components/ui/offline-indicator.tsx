"use client";

import { useOfflineStatus } from "@/hooks/use-offline";
import { WifiOff } from "lucide-react";

export function OfflineIndicator() {
    const { isOffline } = useOfflineStatus();

    if (!isOffline) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground shadow-lg animate-in fade-in slide-in-from-bottom-4">
            <WifiOff className="h-4 w-4" />
            <span>Mode Hors-ligne</span>
        </div>
    );
}
