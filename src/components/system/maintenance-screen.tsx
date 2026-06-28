import { Wrench } from "lucide-react";

/**
 * Écran plein affiché aux utilisateurs non-SUPER_ADMIN quand le mode
 * maintenance globale est actif. Présentationnel (rendu serveur).
 */
export function MaintenanceScreen({ message }: { message: string }) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-warning/10">
                    <Wrench className="h-7 w-7 text-warning" aria-hidden="true" />
                </div>
                <h1 className="text-xl font-semibold text-foreground">Maintenance en cours</h1>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{message}</p>
                <p className="mt-6 text-xs text-muted-foreground">
                    Cette page se rétablira automatiquement à la fin de l'intervention.
                </p>
            </div>
        </div>
    );
}
