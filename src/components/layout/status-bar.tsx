"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
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
            className="flex items-center justify-between px-4 text-[10px] border-t border-white/10 shrink-0 select-none bg-apogee-abyss/80"
            style={{
                height: "var(--statusbar-height)",
            }}
        >
            {/* Left: System status */}
            <div className="flex items-center gap-2">
                <div
                    className={cn(
                        "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                        isOnline
                            ? "text-apogee-emerald bg-apogee-emerald/15"
                            : "text-apogee-crimson bg-apogee-crimson/15"
                    )}
                >
                    {isOnline ? (
                        <>
                            <span className="w-1.5 h-1.5 rounded-full bg-apogee-emerald" />
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
            <div className="text-apogee-metal/70">
                {lastSaved && `Sauvegarde auto · ${lastSaved}`}
            </div>

            {/* Right: Version + Support */}
            <div className="flex items-center gap-3 text-apogee-metal/70">
                <span>v3.0.0</span>
                <button className="hover:text-white transition-colors">
                    Support
                </button>
            </div>
        </footer>
    );
}
