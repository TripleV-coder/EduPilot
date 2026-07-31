"use client";

import { useEffect, useMemo, useState } from "react";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";

import {
    Badge,
    Button,
    Card,
    Icon,
    type IconName,
} from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";

type ClubColor = "info" | "warning" | "success" | "brand" | "danger";

type ClubSeed = {
    id: string;
    name: string;
    category: string;
    members: number;
    professor: string;
    schedule: string;
    color: ClubColor;
    icon: IconName;
    description: string;
};

const CLUBS: ClubSeed[] = [
    {
        id: "robotics",
        name: "Robotique",
        category: "Sciences",
        members: 24,
        professor: "M. Sossou",
        schedule: "Mer 14h-16h",
        color: "info",
        icon: "sparkle",
        description:
            "Construction, programmation, compétition régionale. Niveau débutant à confirmé.",
    },
    {
        id: "theatre",
        name: "Théâtre",
        category: "Arts",
        members: 32,
        professor: "Mme Bossou",
        schedule: "Sam 9h-12h",
        color: "warning",
        icon: "users",
        description:
            "Pièce annuelle pour la fête de fin d'année. Toutes les classes mélangées.",
    },
    {
        id: "football",
        name: "Football",
        category: "Sport",
        members: 56,
        professor: "M. Coffi",
        schedule: "Mer 16h-18h",
        color: "success",
        icon: "flame",
        description:
            "Équipe école · championnat inter-établissements. Filles & garçons.",
    },
    {
        id: "chess",
        name: "Échecs",
        category: "Stratégie",
        members: 18,
        professor: "M. Adjavon",
        schedule: "Ven 16h-17h",
        color: "brand",
        icon: "trophy",
        description: "Tournois mensuels · classement ELO interne. Tous niveaux.",
    },
    {
        id: "chorus",
        name: "Chorale",
        category: "Arts",
        members: 28,
        professor: "Mme Akin",
        schedule: "Jeu 16h-17h30",
        color: "warning",
        icon: "sms",
        description:
            "Cérémonies officielles, concerts. Répertoire local et international.",
    },
    {
        id: "newspaper",
        name: "Journal scolaire",
        category: "Médias",
        members: 14,
        professor: "Mme Bio",
        schedule: "Mar 16h-17h",
        color: "info",
        icon: "pencil",
        description: "Mensuel · interviews, reportages, photos.",
    },
];

const STORAGE_KEY = "edupilot.clubs.subscribed";

export default function ClubsPage() {
    const [subscribed, setSubscribed] = useState<string[]>([]);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) setSubscribed(JSON.parse(raw));
        } catch {
            /* ignore */
        }
        setReady(true);
    }, []);

    const persist = (next: string[]) => {
        setSubscribed(next);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
            /* ignore */
        }
    };

    const toggle = (id: string) => {
        persist(
            subscribed.includes(id)
                ? subscribed.filter((x) => x !== id)
                : [...subscribed, id]
        );
    };

    const myClubs = useMemo(
        () => CLUBS.filter((c) => subscribed.includes(c.id)),
        [subscribed]
    );

    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["STUDENT", "PARENT", "TEACHER", "DIRECTOR", "SCHOOL_ADMIN", "SUPER_ADMIN"]}
        >
            <PageShell className="pb-12">
                <PageHeader
                    title="Clubs & activités"
                    description={`${CLUBS.length} clubs proposés · ${ready ? myClubs.length : 0} ${
                        ready && myClubs.length > 1 ? "auxquels vous êtes inscrit" : "auquel vous êtes inscrit"
                    }`}
                    breadcrumbs={[
                        { label: "Vie scolaire" },
                        { label: "Clubs & activités" },
                    ]}
                    actions={
                        ready ? (
                            <Badge
                                variant={myClubs.length > 0 ? "success" : "neutral"}
                                icon={myClubs.length > 0 ? "check" : undefined}
                            >
                                {myClubs.length > 0
                                    ? `Tu es dans ${myClubs.length} club${myClubs.length > 1 ? "s" : ""}`
                                    : "Aucune inscription"}
                            </Badge>
                        ) : null
                    }
                />

                <Card
                    padding={14}
                    style={{
                        background: "var(--brand-50)",
                        border: "1px solid var(--brand-200)",
                    }}
                >
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <Icon
                            name="info"
                            size={16}
                            color="var(--brand-700)"
                            style={{ marginTop: 2 }}
                        />
                        <div
                            style={{
                                fontSize: 12,
                                color: "var(--brand-800)",
                                lineHeight: 1.55,
                            }}
                        >
                            Catalogue de démonstration · {CLUBS.length} clubs typiques. Les
                            inscriptions sont mémorisées localement sur ton navigateur en attendant
                            le modèle <code>Club</code> + <code>ClubMembership</code> côté Prisma.
                        </div>
                    </div>
                </Card>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 14,
                    }}
                    className="clubs-grid"
                >
                    {CLUBS.map((club) => {
                        const mine = subscribed.includes(club.id);
                        return (
                            <Card
                                key={club.id}
                                padding={20}
                                style={{
                                    border: mine
                                        ? "2px solid var(--eduflow-success-600)"
                                        : "1px solid var(--eduflow-border-default)",
                                    background: mine
                                        ? "var(--eduflow-success-50)"
                                        : "var(--eduflow-surface-card)",
                                    position: "relative",
                                }}
                            >
                                {mine ? (
                                    <div
                                        style={{
                                            position: "absolute",
                                            top: 12,
                                            right: 12,
                                        }}
                                    >
                                        <Badge variant="success" size="sm" icon="check">
                                            Inscrit
                                        </Badge>
                                    </div>
                                ) : null}
                                <div
                                    style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 14,
                                        background: `var(--eduflow-${club.color}-100, var(--brand-100))`,
                                        display: "grid",
                                        placeItems: "center",
                                        marginBottom: 14,
                                    }}
                                >
                                    <Icon
                                        name={club.icon}
                                        size={22}
                                        color={`var(--eduflow-${club.color}-700)`}
                                    />
                                </div>
                                <div
                                    className="eduflow-display"
                                    style={{ fontSize: 18, fontWeight: 700 }}
                                >
                                    {club.name}
                                </div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "var(--eduflow-text-tertiary)",
                                        marginBottom: 10,
                                    }}
                                >
                                    {club.category} · {club.members} membres
                                </div>
                                <p
                                    style={{
                                        fontSize: 12,
                                        color: "var(--eduflow-text-secondary)",
                                        lineHeight: 1.55,
                                        margin: "0 0 12px",
                                    }}
                                >
                                    {club.description}
                                </p>
                                <div
                                    style={{
                                        display: "flex",
                                        gap: 10,
                                        marginBottom: 12,
                                        fontSize: 11,
                                        color: "var(--eduflow-text-tertiary)",
                                        flexWrap: "wrap",
                                    }}
                                >
                                    <span>🗓 {club.schedule}</span>
                                    <span>👨‍🏫 {club.professor}</span>
                                </div>
                                {mine ? (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        style={{ width: "100%" }}
                                        onClick={() => toggle(club.id)}
                                    >
                                        Se désinscrire
                                    </Button>
                                ) : (
                                    <Button
                                        size="sm"
                                        icon="plus"
                                        style={{ width: "100%" }}
                                        onClick={() => toggle(club.id)}
                                    >
                                        Rejoindre
                                    </Button>
                                )}
                            </Card>
                        );
                    })}
                </div>
            </PageShell>

            <style jsx global>{`
                @media (max-width: 960px) {
                    .clubs-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                }
                @media (max-width: 600px) {
                    .clubs-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </PageGuard>
    );
}
