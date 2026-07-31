"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";

import { useSession } from "next-auth/react";
import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";
import { fetcher } from "@/lib/fetcher";

import { Badge, Button, Card, Icon } from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageError, PageLoading } from "@/components/layout/page-states";
import { GroupMessageButton } from "@/components/cagnotte/group-message-button";
import { HowItWorksCard } from "@/components/cagnotte/how-it-works-card";

type CagnotteStatus = "OPEN" | "CLOSED" | "CANCELLED";

type CagnotteRow = {
    id: string;
    title: string;
    description: string | null;
    classId: string | null;
    classLabel: string | null;
    hostLabel: string;
    targetFcfa: string;
    raisedFcfa: string;
    participantCount: number;
    expectedParticipants: number | null;
    deadline: string;
    daysLeft: number;
    status: CagnotteStatus;
    myContributionFcfa: string;
    hasContributed: boolean;
    lastContributionAt: string | null;
    recentInitials: string[];
};

type CagnotteResponse = {
    schoolId: string;
    cagnottes: CagnotteRow[];
};

const FR_NUMBER = new Intl.NumberFormat("fr-FR");
const FR_DATE = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
});

function formatFcfa(value: string | number): string {
    return FR_NUMBER.format(Number(value));
}

function formatK(value: string | number): string {
    return FR_NUMBER.format(Math.round(Number(value) / 1000));
}

function toneFor(deadline: string, daysLeft: number): "brand" | "warning" {
    if (daysLeft <= 7) return "warning";
    void deadline;
    return "brand";
}

export default function CagnottePage() {
    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "PARENT", "TEACHER"]}
        >
            <CagnottePageContent />
        </PageGuard>
    );
}

const CAGNOTTE_BREADCRUMBS = [
    { label: "Communauté" },
    { label: "Cagnottes" },
] as const;

function CagnottePageContent() {
    const { data: session } = useSession();
    // Création réservée direction/enseignants — le bouton est masqué aux parents
    const canCreate = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"].includes(
        session?.user?.role ?? "",
    );
    const { data, error, isLoading } = useSWR<CagnotteResponse>(
        "/api/cagnottes?status=OPEN",
        fetcher,
        { revalidateOnFocus: false },
    );

    if (isLoading) {
        return (
            <PageShell className="pb-12">
                <PageHeader
                    title="Cagnottes & pots communs"
                    description="Chargement des cagnottes actives…"
                    breadcrumbs={[...CAGNOTTE_BREADCRUMBS]}
                />
                <PageLoading label="Chargement des cagnottes…" />
            </PageShell>
        );
    }

    if (error || !data) {
        return (
            <PageShell className="pb-12">
                <PageHeader
                    title="Cagnottes & pots communs"
                    description="Impossible de charger les cagnottes"
                    breadcrumbs={[...CAGNOTTE_BREADCRUMBS]}
                />
                <PageError message="Le service cagnottes est momentanément indisponible." />
            </PageShell>
        );
    }

    const cagnottes = data.cagnottes;
    const openCount = cagnottes.length;

    return (
        <>
        <PageShell className="pb-12">
            <PageHeader
                title="Cagnottes & pots communs"
                description="Sorties scolaires · fournitures partagées · cadeaux profs · 100% transparent"
                breadcrumbs={[...CAGNOTTE_BREADCRUMBS]}
                actions={
                    <>
                        <Badge variant="success" icon="check">
                            {openCount} cagnotte{openCount > 1 ? "s" : ""} en cours
                        </Badge>
                        {canCreate ? (
                            <Link href="/dashboard/cagnotte/new">
                                <Button icon="plus">Créer une cagnotte</Button>
                            </Link>
                        ) : null}
                    </>
                }
            />

            {cagnottes.length === 0 ? (
                <EmptyCagnotteState />
            ) : (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 14,
                    }}
                    className="cag-grid edu-stagger"
                >
                    {cagnottes.map((c) => (
                        <CagnotteCard key={c.id} cagnotte={c} canBroadcast={canCreate} />
                    ))}
                </div>
            )}

            <HowItWorksCard />

            <style jsx global>{`
                @media (max-width: 960px) {
                    .cag-grid {
                        grid-template-columns: 1fr !important;
                    }
                    .cag-banner {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </PageShell>
        </>
    );
}

function EmptyCagnotteState() {
    return (
        <Card
            padding={40}
            style={{
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                minHeight: 360,
                justifyContent: "center",
            }}
        >
            <div
                style={{
                    width: 80,
                    height: 80,
                    borderRadius: 24,
                    background: "var(--brand-50)",
                    display: "grid",
                    placeItems: "center",
                    marginBottom: 18,
                }}
            >
                <Icon name="sparkle" size={36} color="var(--brand-700)" />
            </div>
            <h3
                className="eduflow-display"
                style={{ fontSize: 18, margin: "0 0 8px" }}
            >
                Aucune cagnotte ouverte
            </h3>
            <p
                style={{
                    fontSize: 13,
                    color: "var(--eduflow-text-secondary)",
                    maxWidth: 400,
                    lineHeight: 1.55,
                    margin: 0,
                }}
            >
                Quand un parent ou un enseignant créera un pot commun (sortie scolaire, cadeau
                prof, équipement classe), il apparaîtra ici avec sa barre de progression et le
                journal public des contributions.
            </p>
        </Card>
    );
}

function CagnotteCard({ cagnotte: c, canBroadcast }: { cagnotte: CagnotteRow; canBroadcast: boolean }) {
    const targetN = Number(c.targetFcfa);
    const raisedN = Number(c.raisedFcfa);
    const pct = targetN === 0 ? 0 : Math.min(100, (raisedN / targetN) * 100);
    const tone = toneFor(c.deadline, c.daysLeft);
    const paidTone = c.hasContributed ? "success" : "brand";
    const expected = c.expectedParticipants ?? c.participantCount;
    const lastPaidLabel = c.lastContributionAt
        ? FR_DATE.format(new Date(c.lastContributionAt))
        : null;
    const subtitle = [c.classLabel, `J−${c.daysLeft}`].filter(Boolean).join(" · ");

    return (
        <Card padding={0} style={{ overflow: "hidden" }}>
            <div
                style={{
                    padding: "16px 18px 14px",
                    borderBottom: "1px solid var(--border-subtle)",
                }}
            >
                <Badge variant={tone} size="sm">
                    J−{c.daysLeft}
                </Badge>
                <h3
                    className="eduflow-display"
                    style={{
                        fontSize: 17,
                        fontWeight: 700,
                        margin: "8px 0 4px",
                        lineHeight: 1.3,
                    }}
                >
                    {c.title}
                </h3>
                <p
                    style={{
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                        margin: 0,
                    }}
                >
                    {subtitle ? `${subtitle} · ` : ""}
                    organisé par {c.hostLabel}
                </p>
            </div>

            <div style={{ padding: 18 }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        marginBottom: 8,
                        gap: 8,
                    }}
                >
                    <span
                        className="eduflow-display tabular"
                        style={{
                            fontSize: 26,
                            fontWeight: 800,
                            color: `var(--${tone}-700)`,
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {formatK(raisedN)}
                        <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}> k</span>
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                        sur {formatK(targetN)}k FCFA
                    </span>
                </div>
                <div
                    style={{
                        height: 10,
                        background: "var(--neutral-100)",
                        borderRadius: 5,
                        overflow: "hidden",
                        marginBottom: 10,
                    }}
                    role="progressbar"
                    aria-valuenow={Math.round(pct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                >
                    <div
                        style={{
                            height: "100%",
                            width: `${pct}%`,
                            background: `var(--${tone}-600)`,
                            borderRadius: 5,
                        }}
                    />
                </div>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                        gap: 8,
                    }}
                >
                    <span>
                        <strong
                            style={{ color: `var(--${tone}-700)`, fontSize: 13 }}
                        >
                            {c.participantCount}
                        </strong>
                        /{expected} familles ont participé
                    </span>
                    <span>
                        <strong>{Math.round(pct)}%</strong> atteint
                    </span>
                </div>

                {c.recentInitials.length > 0 && (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            marginTop: 14,
                            marginBottom: 14,
                        }}
                        aria-hidden
                    >
                        {c.recentInitials.map((initials, j) => (
                            <div
                                key={`${initials}-${j}`}
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: "50%",
                                    background: `var(--${tone}-600)`,
                                    border: "2px solid var(--surface-card)",
                                    color: "#fff",
                                    fontSize: 10,
                                    fontWeight: 700,
                                    display: "grid",
                                    placeItems: "center",
                                    marginLeft: j > 0 ? -8 : 0,
                                }}
                            >
                                {initials}
                            </div>
                        ))}
                        {c.participantCount > c.recentInitials.length && (
                            <div
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: "50%",
                                    background: "var(--surface-sunken)",
                                    border: "2px solid var(--surface-card)",
                                    color: "var(--text-secondary)",
                                    fontSize: 9,
                                    fontWeight: 700,
                                    display: "grid",
                                    placeItems: "center",
                                    marginLeft: -8,
                                }}
                            >
                                +{c.participantCount - c.recentInitials.length}
                            </div>
                        )}
                    </div>
                )}

                <div
                    style={{
                        padding: 12,
                        borderRadius: 10,
                        background: `var(--${paidTone}-50)`,
                        border: `1px solid var(--${paidTone}-200)`,
                        marginTop: c.recentInitials.length === 0 ? 14 : 0,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                        }}
                    >
                        <div>
                            <div
                                style={{
                                    fontSize: 11,
                                    color: `var(--${paidTone}-700)`,
                                    fontWeight: 700,
                                }}
                            >
                                Votre participation
                            </div>
                            <div
                                className="eduflow-display tabular"
                                style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                    color: `var(--${paidTone}-900)`,
                                    marginTop: 2,
                                    fontVariantNumeric: "tabular-nums",
                                }}
                            >
                                {c.hasContributed
                                    ? `${formatFcfa(c.myContributionFcfa)} FCFA`
                                    : "—"}
                            </div>
                        </div>
                        {c.hasContributed && lastPaidLabel ? (
                            <Badge variant="success" icon="check">
                                Payé · {lastPaidLabel}
                            </Badge>
                        ) : (
                            <Link href={`/dashboard/cagnotte/${c.id}`}>
                                <Button size="sm" icon="money">
                                    Payer
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>

                <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                    {canBroadcast ? (
                        <div style={{ flex: 1 }}>
                            <GroupMessageButton
                                cagnotteTitle={c.title}
                                classId={c.classId}
                                classLabel={c.classLabel}
                            />
                        </div>
                    ) : null}
                    <Link href={`/dashboard/cagnotte/${c.id}`} style={{ flex: 1, textDecoration: "none" }}>
                        <Button variant="ghost" size="sm" full iconRight="arrowRight">
                            Détails
                        </Button>
                    </Link>
                </div>
            </div>
        </Card>
    );
}
