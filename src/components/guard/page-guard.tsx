"use client";

import { useRBAC } from "@/lib/hooks/use-rbac";
import { Permission } from "@/lib/rbac/permissions";
import type { UserRole } from "@prisma/client";

type PageGuardProps = {
    permission?: Permission | Permission[];
    roles?: UserRole[];
    fallback?: React.ReactNode;
    children: React.ReactNode;
};

/**
 * PageGuard — Protège une page entière selon les permissions RBAC.
 * Affiche un loader pendant le chargement de la session,
 * puis rend les enfants si autorisé, ou un message d'accès refusé.
 */
export function PageGuard({
    permission,
    roles,
    fallback,
    children,
}: PageGuardProps) {
    const { canAccess, status } = useRBAC();

    // Pendant le chargement de la session
    if (status === "loading") {
        return (
            fallback ?? (
                <div className="flex items-center justify-center py-24">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
            )
        );
    }

    // Vérifier les permissions
    const hasRequirement =
        (permission != null &&
            (Array.isArray(permission) ? permission.length > 0 : true)) ||
        (roles != null && roles.length > 0);

    if (hasRequirement) {
        const allowed = canAccess({ permission, roles });
        if (!allowed) {
            return (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="text-4xl mb-4">🔒</div>
                    <h2 className="text-xl font-semibold text-foreground mb-2">
                        Accès refusé
                    </h2>
                    <p className="text-sm text-muted-foreground max-w-md">
                        Vous n&apos;avez pas les permissions nécessaires pour accéder à
                        cette page. Contactez votre administrateur si vous pensez qu&apos;il
                        s&apos;agit d&apos;une erreur.
                    </p>
                </div>
            );
        }
    }

    return <>{children}</>;
}
