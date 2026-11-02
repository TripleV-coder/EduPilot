"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageError, PageLoading } from "@/components/layout/page-states";
import { AvailabilityGrid } from "@/components/teachers/availability-grid";

/**
 * « Mes disponibilités » (enseignant) : une seule grille pour toutes ses
 * écoles, sans nommer d'école. Chaque école la consulte pour son emploi du temps.
 */
export default function MyAvailabilityPage() {
    const { data, error, isLoading, mutate } = useSWR<{ teacherId: string }>("/api/me/schools", fetcher);

    return (
        <PageGuard roles={["TEACHER"]}>
            <PageShell className="max-w-5xl">
                <PageHeader
                    title="Mes disponibilités"
                    description="Indiquez une fois vos jours et heures disponibles. Toutes vos écoles les voient pour construire leur emploi du temps ; aucune ne voit les autres."
                    breadcrumbs={[{ label: "Tableau de bord", href: "/dashboard" }, { label: "Mes disponibilités" }]}
                />
                {isLoading ? (
                    <PageLoading label="Chargement…" />
                ) : error || !data?.teacherId ? (
                    <PageError message="Votre profil enseignant est introuvable." onRetry={() => void mutate()} />
                ) : (
                    <AvailabilityGrid teacherId={data.teacherId} />
                )}
            </PageShell>
        </PageGuard>
    );
}
