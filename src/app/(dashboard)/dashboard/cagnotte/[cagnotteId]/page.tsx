"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";
import { fetcher } from "@/lib/fetcher";

import { Badge, Button, Card, Icon, Input, Progress } from "@/components/edu";
import { SubLabel } from "@/components/edu-homes/_shared";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageError, PageLoading } from "@/components/layout/page-states";

type JournalRow = {
    id: string;
    kind: string;
    amountFcfa: string | null;
    message: string | null;
    actorLabel: string;
    createdAt: string;
};

type ContributionRow = {
    id: string;
    isMine: boolean;
    initials: string;
    amountFcfa: string;
    paidAt: string;
};

type CagnotteDetail = {
    id: string;
    title: string;
    description: string | null;
    status: "OPEN" | "CLOSED" | "CANCELLED";
    classLabel: string | null;
    hostLabel: string;
    targetFcfa: string;
    raisedFcfa: string;
    myContributionFcfa: string;
    hasContributed: boolean;
    participantCount: number;
    expectedParticipants: number | null;
    deadline: string;
    daysLeft: number;
    journal: JournalRow[];
    contributions: ContributionRow[];
};

const FR_NUMBER = new Intl.NumberFormat("fr-FR");
const FR_DATETIME = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
});

const CAGNOTTE_DETAIL_BREADCRUMBS = [
    { label: "Communauté" },
    { label: "Cagnottes", href: "/dashboard/cagnotte" },
    { label: "Détail" },
] as const;

export default function CagnotteDetailPage() {
    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "PARENT", "TEACHER"]}
        >
            <CagnotteDetailContent />
        </PageGuard>
    );
}

function CagnotteDetailContent() {
    const params = useParams<{ cagnotteId: string }>();
    const router = useRouter();
    const { data, error, isLoading, mutate } = useSWR<CagnotteDetail>(
        params?.cagnotteId ? `/api/cagnottes/${params.cagnotteId}` : null,
        fetcher,
        { revalidateOnFocus: false },
    );

    const [amount, setAmount] = React.useState("");
    const [paymentRef, setPaymentRef] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);
    const [contribError, setContribError] = React.useState<string | null>(null);
    const [justPaid, setJustPaid] = React.useState(false);

    async function handleContribute(e: React.FormEvent) {
        e.preventDefault();
        if (!data) return;
        setContribError(null);
        setSubmitting(true);
        try {
            const res = await fetch(`/api/cagnottes/${data.id}/contributions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amountFcfa: Number(amount),
                    paymentRef: paymentRef || undefined,
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                setContribError(json.error ?? "Erreur lors de l'enregistrement.");
                return;
            }
            setJustPaid(true);
            setAmount("");
            setPaymentRef("");
            await mutate();
        } catch {
            setContribError("Erreur réseau. Réessayez.");
        } finally {
            setSubmitting(false);
        }
    }

    if (isLoading) {
        return (
            <PageShell className="max-w-4xl pb-12">
                <PageHeader
                    title="Cagnotte"
                    description="Chargement du détail…"
                    breadcrumbs={[...CAGNOTTE_DETAIL_BREADCRUMBS]}
                />
                <PageLoading label="Chargement de la cagnotte…" />
            </PageShell>
        );
    }

    if (error || !data) {
        return (
            <PageShell className="max-w-4xl pb-12">
                <PageHeader
                    title="Cagnotte introuvable"
                    breadcrumbs={[
                        { label: "Communauté" },
                        { label: "Cagnottes", href: "/dashboard/cagnotte" },
                    ]}
                />
                <PageError
                    message="Cette cagnotte n'existe pas ou n'est plus accessible."
                    onRetry={() => router.push("/dashboard/cagnotte")}
                />
            </PageShell>
        );
    }

    const pct = Math.min(
        100,
        Math.round((Number(data.raisedFcfa) / Math.max(1, Number(data.targetFcfa))) * 100),
    );

    return (
        <PageShell className="max-w-4xl pb-12">
            <PageHeader
                title={data.title}
                description={`${data.classLabel ?? "Toute l'école"} · organisé par ${data.hostLabel}`}
                breadcrumbs={[...CAGNOTTE_DETAIL_BREADCRUMBS]}
                actions={
                    <Badge
                        variant={data.status === "OPEN" ? "brand" : "neutral"}
                        icon={data.status === "OPEN" ? undefined : "check"}
                    >
                        {data.status === "OPEN" ? `J−${data.daysLeft}` : "Clôturée"}
                    </Badge>
                }
            />

            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
                {/* Colonne principale : progression + journal */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <Card padding={24}>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "baseline",
                                justifyContent: "space-between",
                                marginBottom: 10,
                            }}
                        >
                            <span
                                className="eduflow-display tabular-nums"
                                style={{ fontSize: 32, fontWeight: 800, color: "var(--brand-700)" }}
                            >
                                {FR_NUMBER.format(Number(data.raisedFcfa))}{" "}
                                <span style={{ fontSize: 14, color: "var(--eduflow-text-tertiary)" }}>
                                    FCFA
                                </span>
                            </span>
                            <span style={{ fontSize: 13, color: "var(--eduflow-text-tertiary)" }}>
                                sur {FR_NUMBER.format(Number(data.targetFcfa))} FCFA · {pct}%
                            </span>
                        </div>
                        <Progress value={pct} />
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                marginTop: 10,
                                fontSize: 12,
                                color: "var(--eduflow-text-tertiary)",
                            }}
                        >
                            <span>
                                <strong style={{ color: "var(--brand-700)" }}>
                                    {data.participantCount}
                                </strong>
                                {data.expectedParticipants
                                    ? `/${data.expectedParticipants}`
                                    : ""}{" "}
                                familles ont participé
                            </span>
                            <span>
                                Clôture le{" "}
                                {new Intl.DateTimeFormat("fr-FR", {
                                    day: "2-digit",
                                    month: "long",
                                }).format(new Date(data.deadline))}
                            </span>
                        </div>
                        {data.description ? (
                            <p
                                style={{
                                    marginTop: 14,
                                    paddingTop: 14,
                                    borderTop: "1px solid var(--eduflow-border-subtle)",
                                    fontSize: 13,
                                    lineHeight: 1.6,
                                    color: "var(--eduflow-text-secondary)",
                                }}
                            >
                                {data.description}
                            </p>
                        ) : null}
                    </Card>

                    <Card padding={0}>
                        <div
                            style={{
                                padding: "14px 18px",
                                borderBottom: "1px solid var(--eduflow-border-subtle)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                            }}
                        >
                            <div>
                                <h3 className="eduflow-display" style={{ fontSize: 16, margin: 0 }}>
                                    Journal public
                                </h3>
                                <p
                                    style={{
                                        fontSize: 11,
                                        color: "var(--eduflow-text-tertiary)",
                                        margin: "2px 0 0",
                                    }}
                                >
                                    Chaque mouvement est visible par toutes les familles
                                </p>
                            </div>
                            <Badge variant="success" size="sm" icon="check">
                                100% transparent
                            </Badge>
                        </div>
                        {data.journal.length === 0 ? (
                            <p
                                style={{
                                    padding: 18,
                                    fontSize: 12,
                                    color: "var(--eduflow-text-tertiary)",
                                }}
                            >
                                Aucun mouvement pour l&apos;instant.
                            </p>
                        ) : (
                            data.journal.map((j, i) => (
                                <div
                                    key={j.id}
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "28px 1fr auto",
                                        gap: 12,
                                        padding: "10px 18px",
                                        borderTop: i ? "1px solid var(--eduflow-border-subtle)" : 0,
                                        alignItems: "center",
                                    }}
                                >
                                    <Icon
                                        name={j.kind === "CONTRIBUTION" ? "money" : "sms"}
                                        size={16}
                                        color={
                                            j.kind === "CONTRIBUTION"
                                                ? "var(--eduflow-success-600)"
                                                : "var(--eduflow-text-tertiary)"
                                        }
                                    />
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 600 }}>
                                            {j.kind === "CONTRIBUTION"
                                                ? "Contribution reçue"
                                                : (j.message ?? "Note")}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 10,
                                                color: "var(--eduflow-text-tertiary)",
                                            }}
                                        >
                                            {FR_DATETIME.format(new Date(j.createdAt))}
                                            {j.kind === "CONTRIBUTION" && j.message
                                                ? ` · ${j.message}`
                                                : ""}
                                        </div>
                                    </div>
                                    {j.amountFcfa ? (
                                        <span
                                            className="tabular-nums"
                                            style={{
                                                fontSize: 13,
                                                fontWeight: 700,
                                                color: "var(--eduflow-success-700)",
                                            }}
                                        >
                                            +{FR_NUMBER.format(Number(j.amountFcfa))}
                                        </span>
                                    ) : null}
                                </div>
                            ))
                        )}
                    </Card>
                </div>

                {/* Colonne latérale : ma participation */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <Card padding={20}>
                        <SubLabel>Ma participation</SubLabel>
                        {data.hasContributed ? (
                            <div
                                style={{
                                    marginTop: 10,
                                    padding: 14,
                                    borderRadius: 10,
                                    background: "var(--eduflow-success-50)",
                                    border: "1px solid var(--eduflow-success-200)",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: "var(--eduflow-success-700)",
                                    }}
                                >
                                    Vous avez participé
                                </div>
                                <div
                                    className="eduflow-display tabular-nums"
                                    style={{
                                        fontSize: 22,
                                        fontWeight: 800,
                                        color: "var(--eduflow-success-700)",
                                        marginTop: 4,
                                    }}
                                >
                                    {FR_NUMBER.format(Number(data.myContributionFcfa))} FCFA
                                </div>
                            </div>
                        ) : null}

                        {data.status === "OPEN" ? (
                            <form
                                onSubmit={handleContribute}
                                style={{
                                    marginTop: 14,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 10,
                                }}
                            >
                                <Input
                                    type="number"
                                    min="100"
                                    step="100"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="Montant en FCFA"
                                    aria-label="Montant de la contribution en FCFA"
                                    required
                                />
                                <Input
                                    value={paymentRef}
                                    onChange={(e) => setPaymentRef(e.target.value)}
                                    placeholder="Réf. MoMo (optionnel)"
                                    aria-label="Référence de paiement Mobile Money"
                                />
                                {contribError ? (
                                    <div role="alert">
                                        <Badge variant="danger">{contribError}</Badge>
                                    </div>
                                ) : null}
                                {justPaid ? (
                                    <Badge variant="success" icon="check">
                                        Contribution enregistrée. Merci !
                                    </Badge>
                                ) : null}
                                <Button type="submit" icon="money" loading={submitting} full>
                                    {data.hasContributed ? "Participer à nouveau" : "Participer"}
                                </Button>
                                <p
                                    style={{
                                        fontSize: 11,
                                        color: "var(--eduflow-text-tertiary)",
                                        lineHeight: 1.5,
                                        margin: 0,
                                    }}
                                >
                                    Paiement espèces au secrétariat ou MoMo avec référence. Le
                                    paiement Mobile Money intégré arrive avec le webhook
                                    opérateur.
                                </p>
                            </form>
                        ) : null}
                    </Card>

                    <Card padding={0}>
                        <div
                            style={{
                                padding: "14px 18px",
                                borderBottom: "1px solid var(--eduflow-border-subtle)",
                            }}
                        >
                            <h3 className="eduflow-display" style={{ fontSize: 15, margin: 0 }}>
                                Contributions · {data.contributions.length}
                            </h3>
                        </div>
                        {data.contributions.slice(0, 12).map((c, i) => (
                            <div
                                key={c.id}
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "32px 1fr auto",
                                    gap: 10,
                                    padding: "8px 18px",
                                    borderTop: i ? "1px solid var(--eduflow-border-subtle)" : 0,
                                    alignItems: "center",
                                    background: c.isMine ? "var(--brand-50)" : "transparent",
                                }}
                            >
                                <div
                                    aria-hidden
                                    style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: "50%",
                                        background: "var(--brand-600)",
                                        color: "#fff",
                                        fontSize: 10,
                                        fontWeight: 700,
                                        display: "grid",
                                        placeItems: "center",
                                    }}
                                >
                                    {c.initials}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>
                                    {c.isMine ? "Vous" : "Famille"} ·{" "}
                                    {FR_DATETIME.format(new Date(c.paidAt))}
                                </div>
                                <span
                                    className="tabular-nums"
                                    style={{ fontSize: 12, fontWeight: 700 }}
                                >
                                    {FR_NUMBER.format(Number(c.amountFcfa))}
                                </span>
                            </div>
                        ))}
                    </Card>
                </div>
            </div>
        </PageShell>
    );
}
