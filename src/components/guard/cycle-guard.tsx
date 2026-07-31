"use client";

import * as React from "react";
import Link from "next/link";
import { useSchool } from "@/components/providers/school-provider";
import { Button, Card, Icon } from "@/components/edu";

type Cycle = "PRIMARY" | "SECONDARY_COLLEGE" | "SECONDARY_LYCEE";

const CYCLE_LABEL: Record<Cycle, string> = {
    PRIMARY: "Primaire",
    SECONDARY_COLLEGE: "Collège",
    SECONDARY_LYCEE: "Lycée",
};

/**
 * Restreint l'accès d'un écran à un cycle donné, selon les cycles offerts par
 * l'établissement (School.offeredLevels, exposé par le school-provider).
 *
 * Défaut SÛR : tant que les cycles ne sont pas chargés (liste vide), on affiche
 * le contenu — on ne masque jamais hâtivement une fonctionnalité.
 */
export function CycleGuard({
    requires,
    children,
}: {
    requires: Cycle;
    children: React.ReactNode;
}) {
    const { offeredLevels } = useSchool();

    if (!offeredLevels || offeredLevels.length === 0) return <>{children}</>;
    if (offeredLevels.includes(requires)) return <>{children}</>;

    return (
        <div className="eduflow-scope mx-auto flex max-w-3xl flex-col gap-4 pb-12">
            <Card padding={40} style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, minHeight: 320, justifyContent: "center" }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, background: "var(--eduflow-surface-sunken)", display: "grid", placeItems: "center" }}>
                    <Icon name="school" size={32} color="var(--eduflow-text-tertiary)" />
                </div>
                <h3 className="eduflow-display" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                    Cycle {CYCLE_LABEL[requires]} non offert
                </h3>
                <p style={{ fontSize: 13, color: "var(--eduflow-text-tertiary)", maxWidth: 420, lineHeight: 1.55, margin: 0 }}>
                    Cette fonctionnalité concerne le cycle <strong>{CYCLE_LABEL[requires]}</strong>, qui
                    n&apos;est pas configuré pour votre établissement.
                </p>
                <Link href="/dashboard/settings/cycles" style={{ textDecoration: "none" }}>
                    <Button variant="secondary" icon="settings">Configurer les cycles</Button>
                </Link>
            </Card>
        </div>
    );
}
