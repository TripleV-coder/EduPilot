"use client";

import { useParams } from "next/navigation";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { AvailabilityGrid } from "@/components/teachers/availability-grid";

export default function TeacherAvailabilityPage() {
    // Next 16 : `params` est une Promise pour une page ; un composant client lit
    // le segment via useParams (la lecture synchrone donnait `undefined`).
    const { teacherId } = useParams<{ teacherId: string }>();

    return (
        <PageGuard roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
            <PageShell className="max-w-5xl">
                <PageHeader
                    title="Disponibilités de l'enseignant"
                    description="Cliquez sur les créneaux pour définir la disponibilité. Les changements sont enregistrés en cliquant sur Enregistrer."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Enseignants", href: "/dashboard/teachers" },
                        { label: "Disponibilités" },
                    ]}
                />
                <AvailabilityGrid teacherId={teacherId} />
            </PageShell>
        </PageGuard>
    );
}
