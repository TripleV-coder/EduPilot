"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useSchool } from "@/components/providers/school-provider";
import { moduleForPagePath } from "@/lib/modules/catalog";
import { Button, Card, Icon } from "@/components/edu";

/**
 * Écran d'un module que l'établissement n'a pas activé (Lot 6 — minimisation).
 *
 * Monté une seule fois dans la coque du tableau de bord : il regarde le chemin
 * courant, pas chaque page. L'API est de toute façon fermée
 * (`createApiHandler` → 403 MODULE_DISABLED) ; ceci évite d'afficher un écran
 * en erreur à quelqu'un qui arrive par un lien.
 *
 * Défaut SÛR : tant que la liste des modules n'est pas chargée, le contenu est
 * affiché — on ne masque jamais hâtivement.
 */
export function ModuleGuard({ children }: { children: React.ReactNode }) {
    const pathname = usePathname() || "";
    const { enabledModules } = useSchool();
    const { data: session } = useSession();

    if (session?.user?.role === "SUPER_ADMIN") return <>{children}</>;
    if (!enabledModules || enabledModules.length === 0) return <>{children}</>;

    const required = moduleForPagePath(pathname);
    if (!required || enabledModules.includes(required.id)) return <>{children}</>;

    return (
        <div className="eduflow-scope mx-auto flex max-w-3xl flex-col gap-4 pb-12">
            <Card padding={40} style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, minHeight: 320, justifyContent: "center" }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, background: "var(--eduflow-surface-sunken)", display: "grid", placeItems: "center" }}>
                    <Icon name="settings" size={32} color="var(--eduflow-text-tertiary)" />
                </div>
                <h3 className="eduflow-display" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                    Module « {required.label} » non activé
                </h3>
                <p style={{ fontSize: 13, color: "var(--eduflow-text-tertiary)", maxWidth: 420, lineHeight: 1.55, margin: 0 }}>
                    {required.description} Votre établissement ne l&apos;a pas activé : aucune donnée de
                    ce type n&apos;est collectée.
                </p>
                {session?.user?.role === "SCHOOL_ADMIN" ? (
                    <Link href="/dashboard/settings/modules" style={{ textDecoration: "none" }}>
                        <Button variant="secondary" icon="settings">Gérer les modules</Button>
                    </Link>
                ) : (
                    <p style={{ fontSize: 12, color: "var(--eduflow-text-tertiary)", margin: 0 }}>
                        Contactez la direction de votre établissement pour l&apos;activer.
                    </p>
                )}
            </Card>
        </div>
    );
}
