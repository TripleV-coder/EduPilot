"use client";

import type { AutoSaveStatus } from "@/hooks/use-autosave";
import { Icon } from "./icon";
import { Spinner } from "./spinner";

export interface SaveStatusProps {
    status: AutoSaveStatus;
    lastSavedAt?: Date | null;
    error?: string | null;
    isOnline?: boolean;
    /** Relance la sauvegarde après un échec. */
    onRetry?: () => void;
    className?: string;
}

function formatTime(date: Date): string {
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Indicateur discret d'auto-save. Annonce les changements aux lecteurs d'écran
 * via `aria-live="polite"`. À placer près du titre ou du pied de formulaire.
 */
export function SaveStatus({
    status,
    lastSavedAt,
    error,
    isOnline = true,
    onRetry,
    className,
}: SaveStatusProps) {
    const base = "inline-flex items-center gap-1.5 text-xs font-medium";

    let content: React.ReactNode;

    if (!isOnline) {
        content = (
            <span className={base} style={{ color: "var(--eduflow-text-tertiary)" }}>
                <Icon name="warning" size={13} />
                Hors ligne — sauvegarde en attente
            </span>
        );
    } else {
        switch (status) {
            case "saving":
                content = (
                    <span className={base} style={{ color: "var(--eduflow-text-tertiary)" }}>
                        <Spinner size={12} />
                        Enregistrement…
                    </span>
                );
                break;
            case "saved":
                content = (
                    <span className={base} style={{ color: "var(--eduflow-success-700)" }}>
                        <Icon name="success" size={13} />
                        {lastSavedAt ? `Enregistré à ${formatTime(lastSavedAt)}` : "Enregistré"}
                    </span>
                );
                break;
            case "dirty":
                content = (
                    <span className={base} style={{ color: "var(--eduflow-text-tertiary)" }}>
                        <Icon name="info" size={13} />
                        Modifications non enregistrées
                    </span>
                );
                break;
            case "error":
                content = (
                    <span className={base} style={{ color: "var(--eduflow-danger-600)" }}>
                        <Icon name="warning" size={13} />
                        {error || "Échec de la sauvegarde"}
                        {onRetry ? (
                            <button
                                type="button"
                                onClick={onRetry}
                                className="underline underline-offset-2 hover:no-underline"
                                style={{ color: "var(--eduflow-danger-700)" }}
                            >
                                Réessayer
                            </button>
                        ) : null}
                    </span>
                );
                break;
            default:
                content = null;
        }
    }

    return (
        <span
            className={className}
            aria-live="polite"
            role="status"
            style={{ minHeight: 18, display: "inline-flex", alignItems: "center" }}
        >
            {content}
        </span>
    );
}
