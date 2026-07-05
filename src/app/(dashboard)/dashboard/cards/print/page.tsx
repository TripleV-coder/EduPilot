"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { PageLoading, PageError, PageEmpty } from "@/components/layout/page-states";
import { Button } from "@/components/edu";
import { StudentIdCard, type StudentCardView } from "@/components/students/student-id-card";

const CARD_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"] as const;

interface SingleResponse {
    card: StudentCardView;
}
interface BatchResponse {
    className: string;
    count: number;
    cards: StudentCardView[];
}

function PrintCardsInner() {
    const params = useSearchParams();
    const studentId = params.get("studentId");
    const classId = params.get("classId");

    const key = studentId
        ? `/api/students/${studentId}/card`
        : classId
          ? `/api/classes/${classId}/cards`
          : null;

    const { data, error, isLoading } = useSWR<SingleResponse | BatchResponse>(key, fetcher);

    if (!key) {
        return (
            <PageEmpty
                title="Aucune sélection"
                description="Ajoute ?studentId=… ou ?classId=… à l'URL pour générer des cartes."
            />
        );
    }
    if (isLoading) return <PageLoading label="Génération des cartes…" />;
    if (error) return <PageError message="Impossible de générer les cartes. Réessaie plus tard." />;

    const cards: StudentCardView[] = data
        ? "cards" in data
            ? data.cards
            : [data.card]
        : [];

    if (cards.length === 0) {
        return <PageEmpty title="Aucune carte" description="Aucun élève actif à imprimer pour cette sélection." />;
    }

    const title =
        data && "className" in data
            ? `Cartes — ${data.className} (${cards.length})`
            : cards[0]?.fullName ?? "Carte scolaire";

    return (
        <div>
            {/* Barre d'action — masquée à l'impression */}
            <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
                <div>
                    <h1 className="eduflow-display" style={{ fontSize: 22, margin: 0 }}>
                        {title}
                    </h1>
                    <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--eduflow-text-tertiary)" }}>
                        Vérifie l&apos;aperçu puis lance l&apos;impression (ou « Enregistrer en PDF »).
                    </p>
                </div>
                <Button icon="download" onClick={() => window.print()}>
                    Imprimer les cartes
                </Button>
            </div>

            {/* Grille de cartes */}
            <div
                className="student-cards-grid"
                style={{ display: "flex", flexWrap: "wrap", gap: "6mm", justifyContent: "flex-start" }}
            >
                {cards.map((card) => (
                    <StudentIdCard key={card.matricule} card={card} />
                ))}
            </div>
        </div>
    );
}

export default function PrintCardsPage() {
    return (
        <PageGuard roles={[...CARD_ROLES]}>
            <Suspense fallback={<PageLoading label="Chargement…" />}>
                <PrintCardsInner />
            </Suspense>
        </PageGuard>
    );
}
