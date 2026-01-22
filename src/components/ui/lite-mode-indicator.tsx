"use client";

import { Zap, X } from "lucide-react";
import { useLiteMode } from "@/components/providers/lite-mode-provider";

/**
 * Visual indicator shown when Lite Mode is active.
 * Allows users to understand why the app looks simpler
 * and provides option to disable if they want full experience.
 */
export function LiteModeIndicator() {
    const { isLiteMode, autoEnabled, disableLiteMode, capabilities } = useLiteMode();

    if (!isLiteMode) return null;

    const reason = autoEnabled
        ? capabilities.isSlowConnection
            ? "Connexion lente détectée"
            : capabilities.isLowEndDevice
                ? "Appareil économique détecté"
                : "Mode économie activé"
        : "Mode Lite activé";

    return (
        <div className="lite-mode-indicator">
            <Zap className="h-4 w-4" />
            <span>{reason}</span>
            <button
                onClick={disableLiteMode}
                title="Désactiver le mode Lite"
                aria-label="Désactiver le mode Lite"
            >
                <X className="h-3 w-3" />
            </button>
        </div>
    );
}

export default LiteModeIndicator;
