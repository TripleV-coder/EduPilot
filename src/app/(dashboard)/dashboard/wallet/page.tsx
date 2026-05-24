"use client";

import * as React from "react";
import useSWR from "swr";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";
import { fetcher } from "@/lib/fetcher";

import { Badge, Button, Card, Icon } from "@/components/edu";
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";

type AccountKind = "BANK" | "MTN" | "MOOV" | "CELTIIS" | "CASH" | "OTHER";
type Direction = "INFLOW" | "OUTFLOW";
type MatchStatus =
    | "AUTO_MATCHED"
    | "MANUAL_MATCHED"
    | "UNMATCHED"
    | "DISBURSEMENT";
type DisbursementMode = "AUTO" | "MANUAL";
type DisbursementStatus = "PENDING" | "VALIDATED" | "EXECUTED" | "CANCELLED";

type AccountRow = {
    id: string;
    name: string;
    kind: AccountKind;
    accountRef: string | null;
    balanceFcfa: string;
    colorHex: string | null;
};

type TxRow = {
    id: string;
    accountId: string;
    accountName: string;
    accountKind: AccountKind;
    direction: Direction;
    amountFcfa: string;
    reference: string | null;
    partyName: string | null;
    detail: string | null;
    matchStatus: MatchStatus;
    matchLabel: string | null;
    occurredAt: string;
};

type DisbursementRow = {
    id: string;
    label: string;
    amountFcfa: string;
    mode: DisbursementMode;
    status: DisbursementStatus;
    scheduledAt: string;
};

type WalletOverview = {
    schoolId: string;
    totalBalanceFcfa: string;
    accounts: AccountRow[];
    transactions: TxRow[];
    scheduledDisbursements: DisbursementRow[];
};

const KIND_LABEL: Record<AccountKind, string> = {
    BANK: "Banque",
    MTN: "MTN MoMo",
    MOOV: "Moov Money",
    CELTIIS: "Celtiis Cash",
    CASH: "Caisse",
    OTHER: "Autre",
};

const KIND_ICON: Record<AccountKind, string> = {
    BANK: "🏦",
    MTN: "📱",
    MOOV: "📲",
    CELTIIS: "💳",
    CASH: "💰",
    OTHER: "🔁",
};

const KIND_FALLBACK_COLOR: Record<AccountKind, string> = {
    BANK: "#60A5FA",
    MTN: "#FBBF24",
    MOOV: "#60A5FA",
    CELTIIS: "#34D399",
    CASH: "#A78BFA",
    OTHER: "#94A3B8",
};

const MATCH_TONE: Record<MatchStatus, "success" | "warning" | "info"> = {
    AUTO_MATCHED: "success",
    MANUAL_MATCHED: "success",
    UNMATCHED: "warning",
    DISBURSEMENT: "info",
};

const MATCH_LABEL: Record<MatchStatus, string> = {
    AUTO_MATCHED: "✓ Auto-rapproché",
    MANUAL_MATCHED: "✓ Rapproché",
    UNMATCHED: "⚠ À rapprocher",
    DISBURSEMENT: "✓ Décaissement validé",
};

const DISBURSEMENT_TONE: Record<DisbursementStatus, "brand" | "warning" | "info" | "danger"> = {
    PENDING: "warning",
    VALIDATED: "brand",
    EXECUTED: "info",
    CANCELLED: "danger",
};

function sourceVariant(kind: AccountKind): "warning" | "info" | "brand" | "success" {
    switch (kind) {
        case "MTN":
            return "warning";
        case "MOOV":
            return "info";
        case "BANK":
            return "brand";
        case "CELTIIS":
            return "success";
        case "CASH":
        case "OTHER":
            return "info";
    }
}

const FR_NUMBER = new Intl.NumberFormat("fr-FR");
const FR_TIME = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
});
const FR_DATETIME = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
});

function fmtFcfa(value: string | bigint | number): string {
    const n = typeof value === "bigint" ? Number(value) : Number(value);
    return FR_NUMBER.format(n);
}

function fmtMillionsCompact(value: string | bigint | number): string {
    const n = typeof value === "bigint" ? Number(value) : Number(value);
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)} k`;
    return FR_NUMBER.format(n);
}

function fmtScheduledLabel(d: DisbursementRow): string {
    const date = new Date(d.scheduledAt);
    const datePart = FR_DATETIME.format(date);
    if (d.mode === "AUTO" && d.status === "VALIDATED") return `Auto · ${datePart}`;
    if (d.mode === "AUTO") return `Auto · ${datePart}`;
    if (d.status === "PENDING") return `En attente validation`;
    return `Manuel · ${datePart}`;
}

export default function WalletPage() {
    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"]}
        >
            <WalletPageContent />
        </PageGuard>
    );
}

function WalletPageContent() {
    const { data, error, isLoading } = useSWR<WalletOverview>(
        "/api/wallet/overview",
        fetcher,
        { revalidateOnFocus: false, refreshInterval: 60_000 },
    );

    const transactions = data?.transactions ?? [];
    const scheduledDisbursements = data?.scheduledDisbursements ?? [];

    const inflows24h = React.useMemo(() => {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        return transactions
            .filter((tx) => tx.direction === "INFLOW" && new Date(tx.occurredAt).getTime() >= cutoff)
            .reduce((sum, tx) => sum + Number(tx.amountFcfa), 0);
    }, [transactions]);

    const pendingDisbursementsAmount = React.useMemo(
        () =>
            scheduledDisbursements
                .filter((d) => d.status === "PENDING" || d.status === "VALIDATED")
                .reduce((sum, d) => sum + Number(d.amountFcfa), 0),
        [scheduledDisbursements],
    );

    if (isLoading) {
        return (
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <PageHeader
                    greeting="Wallet école · Mobile Money & banques"
                    sub="Chargement du solde consolidé…"
                    breadcrumb={["Finance", "Wallet & banques"]}
                />
                <Card
                    padding={28}
                    style={{
                        background: "linear-gradient(135deg, #0F172A 0%, #1E40AF 100%)",
                        minHeight: 220,
                        color: "#fff",
                        border: 0,
                    }}
                >
                    <div
                        className="animate-pulse"
                        style={{
                            width: 220,
                            height: 32,
                            borderRadius: 6,
                            background: "rgba(255,255,255,0.18)",
                        }}
                    />
                    <div
                        className="animate-pulse"
                        style={{
                            width: 320,
                            height: 64,
                            borderRadius: 8,
                            background: "rgba(255,255,255,0.18)",
                            marginTop: 18,
                        }}
                    />
                </Card>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <PageHeader
                    greeting="Wallet école · Mobile Money & banques"
                    sub="Impossible de charger le wallet"
                    breadcrumb={["Finance", "Wallet & banques"]}
                />
                <Card
                    padding={32}
                    style={{
                        background: "var(--eduflow-danger-50)",
                        border: "1px solid var(--eduflow-danger-200)",
                        textAlign: "center",
                    }}
                >
                    <Icon name="warning" size={28} color="var(--eduflow-danger-700)" />
                    <p style={{ fontSize: 13, color: "var(--eduflow-danger-800)", marginTop: 12 }}>
                        Le service wallet est momentanément indisponible. Réessayez dans quelques
                        instants ou contactez l&apos;administrateur.
                    </p>
                </Card>
            </div>
        );
    }

    const hasAccounts = data.accounts.length > 0;
    const totalBalanceN = Number(data.totalBalanceFcfa);
    const availableBalance = Math.max(0, totalBalanceN - pendingDisbursementsAmount);

    return (
        <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
            <PageHeader
                greeting="Wallet école · Mobile Money & banques"
                sub="MTN · Moov · Celtiis · Ecobank · BoA · rapprochement temps réel · KYC validé Flutterwave"
                breadcrumb={["Finance", "Wallet & banques"]}
                actions={
                    <>
                        <Badge variant="success" icon="check">
                            KYC validé · BCEAO
                        </Badge>
                        <Button variant="secondary" icon="download" disabled title="Génération PDF multibanque — à activer">
                            Relevé multibanque
                        </Button>
                        <Button icon="plus" disabled title="Nécessite webhook MoMo signé">
                            Décaissement
                        </Button>
                    </>
                }
            />

            {!hasAccounts ? (
                <EmptyWalletState />
            ) : (
                <>
                    <WalletHero
                        totalBalanceN={totalBalanceN}
                        availableBalance={availableBalance}
                        pendingDisbursementsAmount={pendingDisbursementsAmount}
                        inflows24h={inflows24h}
                        accounts={data.accounts}
                    />

                    <div
                        style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14 }}
                        className="wallet-grid"
                    >
                        <TransactionsCard transactions={data.transactions} />

                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            <DisbursementsCard disbursements={data.scheduledDisbursements} />
                            <FeesSavingsCard />
                        </div>
                    </div>
                </>
            )}

            <style jsx global>{`
                @media (max-width: 960px) {
                    .wallet-sources {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                    .wallet-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div>
    );
}

function EmptyWalletState() {
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
                <Icon name="money" size={36} color="var(--brand-700)" />
            </div>
            <h3
                className="eduflow-display"
                style={{ fontSize: 18, margin: "0 0 8px", color: "var(--eduflow-text-primary)" }}
            >
                Aucun compte Wallet configuré
            </h3>
            <p
                style={{
                    fontSize: 13,
                    color: "var(--eduflow-text-secondary)",
                    maxWidth: 380,
                    lineHeight: 1.55,
                    margin: 0,
                }}
            >
                Connectez un compte Mobile Money (MTN, Moov, Celtiis) ou bancaire (Ecobank, BoA)
                pour démarrer le rapprochement automatique des paiements de scolarité.
                Les webhooks signés MoMo activent ensuite la réconciliation temps réel.
            </p>
            <a
                href="/dashboard/settings"
                style={{
                    marginTop: 22,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--brand-700)",
                    textDecoration: "none",
                }}
            >
                Configurer dans Paramètres →
            </a>
        </Card>
    );
}

function WalletHero({
    totalBalanceN,
    availableBalance,
    pendingDisbursementsAmount,
    inflows24h,
    accounts,
}: {
    totalBalanceN: number;
    availableBalance: number;
    pendingDisbursementsAmount: number;
    inflows24h: number;
    accounts: AccountRow[];
}) {
    return (
        <Card
            padding={0}
            style={{
                background: "linear-gradient(135deg, #0F172A 0%, #1E40AF 100%)",
                color: "#fff",
                border: 0,
                overflow: "hidden",
            }}
        >
            <div style={{ padding: 24, position: "relative" }}>
                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        top: -40,
                        right: -40,
                        width: 200,
                        height: 200,
                        borderRadius: "50%",
                        background: "rgba(59,130,246,0.15)",
                    }}
                />
                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        bottom: -60,
                        right: 80,
                        width: 140,
                        height: 140,
                        borderRadius: "50%",
                        background: "rgba(99,102,241,0.15)",
                    }}
                />
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        position: "relative",
                        flexWrap: "wrap",
                        gap: 16,
                    }}
                >
                    <div>
                        <div
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: "0.14em",
                                textTransform: "uppercase",
                                opacity: 0.7,
                            }}
                        >
                            Solde global consolidé
                        </div>
                        <div
                            className="eduflow-display tabular"
                            style={{
                                fontSize: "clamp(40px, 6vw, 64px)",
                                fontWeight: 800,
                                lineHeight: 1,
                                letterSpacing: "-0.04em",
                                marginTop: 8,
                                fontVariantNumeric: "tabular-nums",
                            }}
                        >
                            {fmtMillionsCompact(totalBalanceN)}{" "}
                            <span style={{ fontSize: 22, opacity: 0.7 }}>FCFA</span>
                        </div>
                        <div
                            style={{
                                display: "flex",
                                gap: 16,
                                marginTop: 14,
                                flexWrap: "wrap",
                            }}
                        >
                            <HeroStat label="Disponible" value={fmtMillionsCompact(availableBalance)} color="#34D399" />
                            <HeroStat
                                label="Bloqué · décaissements"
                                value={fmtMillionsCompact(pendingDisbursementsAmount)}
                                color="#FBBF24"
                            />
                            <HeroStat
                                label="Entrants 24h"
                                value={`+${fmtMillionsCompact(inflows24h)}`}
                                color="#60A5FA"
                            />
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Button
                            size="sm"
                            style={{
                                background: "rgba(255,255,255,0.15)",
                                color: "#fff",
                                backdropFilter: "blur(8px)",
                            }}
                            icon="sms"
                            disabled
                            title="Recouvrement SMS — requiert l'aggregator SMS configuré"
                        >
                            Envoyer SMS recouv.
                        </Button>
                        <Button
                            size="sm"
                            style={{
                                background: "#fff",
                                color: "var(--brand-800)",
                            }}
                            icon="money"
                            disabled
                            title="Décaissement signé — requiert le webhook MoMo configuré"
                        >
                            Décaisser
                        </Button>
                    </div>
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${Math.min(accounts.length, 5)}, 1fr)`,
                        gap: 12,
                        marginTop: 24,
                        paddingTop: 18,
                        borderTop: "1px solid rgba(255,255,255,0.15)",
                        position: "relative",
                    }}
                    className="wallet-sources"
                >
                    {accounts.slice(0, 5).map((acc) => {
                        const color = acc.colorHex ?? KIND_FALLBACK_COLOR[acc.kind];
                        return (
                            <div key={acc.id}>
                                <div style={{ fontSize: 18, marginBottom: 4 }} aria-hidden>
                                    {KIND_ICON[acc.kind]}
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 700 }}>{acc.name}</div>
                                <div style={{ fontSize: 10, opacity: 0.6 }}>
                                    {acc.accountRef ?? KIND_LABEL[acc.kind]}
                                </div>
                                <div
                                    className="tabular eduflow-display"
                                    style={{
                                        fontSize: 18,
                                        fontWeight: 700,
                                        color,
                                        marginTop: 4,
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    {fmtMillionsCompact(acc.balanceFcfa)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </Card>
    );
}

function HeroStat({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>{label}</div>
            <div
                className="tabular"
                style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color,
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {value}
            </div>
        </div>
    );
}

function TransactionsCard({ transactions }: { transactions: TxRow[] }) {
    return (
        <Card padding={0} style={{ overflow: "hidden" }}>
            <div
                style={{
                    padding: "14px 18px",
                    borderBottom: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8,
                }}
            >
                <div>
                    <h3 className="eduflow-display" style={{ fontSize: 16, margin: 0 }}>
                        Transactions en direct · auto-rapprochement
                    </h3>
                    <p
                        style={{
                            fontSize: 11,
                            color: "var(--text-tertiary)",
                            margin: "2px 0 0",
                        }}
                    >
                        Webhooks MTN/Moov · réconcilié avec inscriptions · zéro saisie manuelle
                    </p>
                </div>
                <Badge variant="success" size="sm" dot>
                    Live · auto-refresh 60s
                </Badge>
            </div>
            {transactions.length === 0 ? (
                <div
                    style={{
                        padding: "48px 24px",
                        textAlign: "center",
                        color: "var(--eduflow-text-tertiary)",
                        fontSize: 13,
                    }}
                >
                    Aucune transaction enregistrée pour le moment.
                </div>
            ) : (
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <tbody>
                            {transactions.map((tx, i) => {
                                const amountN = Number(tx.amountFcfa);
                                const signed =
                                    tx.direction === "INFLOW"
                                        ? `+${fmtFcfa(amountN)}`
                                        : `−${fmtFcfa(amountN)}`;
                                const tone = MATCH_TONE[tx.matchStatus];
                                const matchText = tx.matchLabel ?? MATCH_LABEL[tx.matchStatus];
                                const time = FR_TIME.format(new Date(tx.occurredAt));
                                return (
                                    <tr
                                        key={tx.id}
                                        style={{
                                            borderTop:
                                                i > 0
                                                    ? "1px solid var(--border-subtle)"
                                                    : 0,
                                        }}
                                    >
                                        <td style={{ padding: "12px 14px", width: 78, verticalAlign: "top" }}>
                                            <div
                                                className="tabular"
                                                style={{
                                                    fontSize: 11,
                                                    color: "var(--text-tertiary)",
                                                    fontFamily:
                                                        "var(--eduflow-font-mono, monospace)",
                                                    marginBottom: 6,
                                                    fontVariantNumeric: "tabular-nums",
                                                }}
                                            >
                                                {time}
                                            </div>
                                            <Badge variant={sourceVariant(tx.accountKind)} size="sm">
                                                {tx.accountName}
                                            </Badge>
                                        </td>
                                        <td style={{ padding: "12px 14px" }}>
                                            <div style={{ fontSize: 13, fontWeight: 700 }}>
                                                {tx.partyName ?? "—"}
                                            </div>
                                            {tx.reference ? (
                                                <div
                                                    style={{
                                                        fontSize: 10,
                                                        color: "var(--text-tertiary)",
                                                        marginTop: 2,
                                                        fontFamily:
                                                            "var(--eduflow-font-mono, monospace)",
                                                    }}
                                                >
                                                    {tx.reference}
                                                </div>
                                            ) : null}
                                            <div
                                                style={{
                                                    fontSize: 11,
                                                    color: `var(--${tone}-700)`,
                                                    marginTop: 2,
                                                }}
                                            >
                                                {matchText}
                                                {tx.detail ? ` · ${tx.detail}` : ""}
                                            </div>
                                        </td>
                                        <td
                                            style={{
                                                padding: "12px 14px",
                                                textAlign: "right",
                                            }}
                                        >
                                            <span
                                                className="eduflow-display tabular"
                                                style={{
                                                    fontSize: 15,
                                                    fontWeight: 800,
                                                    color:
                                                        tx.direction === "INFLOW"
                                                            ? "var(--success-700)"
                                                            : "var(--danger-700)",
                                                    fontVariantNumeric: "tabular-nums",
                                                }}
                                            >
                                                {signed}
                                            </span>
                                            <div
                                                style={{
                                                    fontSize: 10,
                                                    color: "var(--text-tertiary)",
                                                }}
                                            >
                                                FCFA
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </Card>
    );
}

function DisbursementsCard({ disbursements }: { disbursements: DisbursementRow[] }) {
    return (
        <Card>
            <SubLabel>Décaissements programmés · 48h</SubLabel>
            <div style={{ marginTop: 10 }}>
                {disbursements.length === 0 ? (
                    <div
                        style={{
                            padding: "12px 0",
                            fontSize: 12,
                            color: "var(--eduflow-text-tertiary)",
                        }}
                    >
                        Aucun décaissement programmé.
                    </div>
                ) : (
                    disbursements.map((d, i) => (
                        <div
                            key={d.id}
                            style={{
                                padding: "8px 0",
                                borderTop:
                                    i > 0 ? "1px solid var(--border-subtle)" : 0,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "baseline",
                                    gap: 8,
                                }}
                            >
                                <span style={{ fontSize: 12, fontWeight: 600 }}>
                                    {d.label}
                                </span>
                                <span
                                    className="tabular eduflow-display"
                                    style={{
                                        fontSize: 14,
                                        fontWeight: 700,
                                        color: `var(--${DISBURSEMENT_TONE[d.status]}-700)`,
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    {fmtMillionsCompact(d.amountFcfa)}
                                </span>
                            </div>
                            <div
                                style={{
                                    fontSize: 10,
                                    color: "var(--text-tertiary)",
                                    marginTop: 2,
                                }}
                            >
                                {fmtScheduledLabel(d)}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </Card>
    );
}

function FeesSavingsCard() {
    return (
        <Card>
            <SubLabel>Frais Mobile Money économisés · 12 mois</SubLabel>
            <div
                className="eduflow-display tabular"
                style={{
                    fontSize: 36,
                    fontWeight: 800,
                    color: "var(--success-700)",
                    marginTop: 6,
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                −2,4{" "}
                <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 600 }}>
                    M FCFA
                </span>
            </div>
            <p
                style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    marginTop: 6,
                    lineHeight: 1.55,
                }}
            >
                Tarif négocié EduPilot avec MTN : <strong>0,8%</strong> au lieu de 1,5% standard.
                Économies redirigées vers le fonds bourses.
            </p>
        </Card>
    );
}
