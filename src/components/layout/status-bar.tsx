"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// STATUS BAR COMPONENT (2026 SaaS Standard)
// 28px height, minimal, fixed at bottom
// ============================================

export function StatusBar() {
    const [isOnline, setIsOnline] = useState(true);
    const [lastSaved, setLastSaved] = useState<string | null>(null);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        setIsOnline(navigator.onLine);
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        // Simulate last saved time
        setLastSaved(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    return (
        <footer
            className="flex items-center justify-between px-4 text-[11px] border-t border-border shrink-0 select-none"
            style={{
                height: "var(--statusbar-height)",
                backgroundColor: "hsl(220 14% 96%)", // Gris très légèrement bleuté
            }}
        >
            {/* Left: System status */}
            <div className="flex items-center gap-2">
                <div
                    className={cn(
                        "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                        isOnline
                            ? "text-green-700 bg-green-100"
                            : "text-red-700 bg-red-100"
                    )}
                >
                    {isOnline ? (
                        <>
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            Opérationnel
                        </>
                    ) : (
                        <>
                            <WifiOff className="h-2.5 w-2.5" />
                            Hors ligne
                        </>
                    )}
                </div>
            </div>

            {/* Center: Last saved / Auto-sync */}
            <div className="text-muted-foreground">
                {lastSaved && `Sauvegarde auto · ${lastSaved}`}
            </div>

            {/* Right: Version + Support */}
            <div className="flex items-center gap-3 text-muted-foreground">
                <span>v3.0.0</span>
                <button className="hover:text-foreground transition-colors">
                    Support
                </button>
            </div>
        </footer>
    );
}
