"use client";

import * as React from "react";
import useSWR from "swr";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";
import { fetcher } from "@/lib/fetcher";

import { Badge, Button, Card, Icon } from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageError, PageLoading } from "@/components/layout/page-states";
import { toast } from "sonner";
import { ResourceActions } from "@/components/shared/resource-actions";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Banknote, Landmark, Repeat, Smartphone, type LucideIcon } from "lucide-react";

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
    /** Solde calculé (ouverture + encaissements validés + mouvements − décaissements). */
    balanceFcfa: string;
    openingBalanceFcfa?: string;
    collectedFcfa?: string;
    manualNetFcfa?: string;
    disbursedFcfa?: string;
    receivesPayments?: boolean;
    declaredAt?: string;
    colorHex: string | null;
};

type ReceiptRow = {
    id: string;
    amountFcfa: number;
    method: string;
    online: boolean;
    reference: string | null;
    occurredAt: string;
    studentName: string;
    feeName: string | null;
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
    recentReceipts?: ReceiptRow[];
};

const KIND_LABEL: Record<AccountKind, string> = {
    BANK: "Banque",
    MTN: "MTN MoMo",
    MOOV: "Moov Money",
    CELTIIS: "Celtiis Cash",
    CASH: "Caisse",
    OTHER: "Autre",
};

// Icônes vectorielles (thémables, lisibles partout) plutôt qu'émojis,
// dont le rendu dépend de la police du téléphone.
const KIND_ICON: Record<AccountKind, LucideIcon> = {
    BANK: Landmark,
    MTN: Smartphone,
    MOOV: Smartphone,
    CELTIIS: Smartphone,
    CASH: Banknote,
    OTHER: Repeat,
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
    const { data, error, isLoading, mutate } = useSWR<WalletOverview>(
        "/api/wallet/overview",
        fetcher,
        { revalidateOnFocus: false, refreshInterval: 60_000 },
    );
    const [declareOpen, setDeclareOpen] = React.useState(false);

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

    const walletBreadcrumbs = [
        { label: "Finance" },
        { label: "Wallet & banques" },
    ] as const;

    if (isLoading) {
        return (
            <PageShell>
                <PageHeader
                    title="Wallet école · Mobile Money & banques"
                    description="Chargement du solde consolidé…"
                    breadcrumbs={[...walletBreadcrumbs]}
                />
                <PageLoading label="Chargement du wallet…" />
            </PageShell>
        );
    }

    if (error || !data) {
        return (
            <PageShell>
                <PageHeader
                    title="Wallet école · Mobile Money & banques"
                    description="Impossible de charger le wallet"
                    breadcrumbs={[...walletBreadcrumbs]}
                />
                <PageError
                    message="Le service wallet est momentanément indisponible. Réessayez dans quelques instants ou contactez l'administrateur."
                />
            </PageShell>
        );
    }

    const hasAccounts = data.accounts.length > 0;
    const totalBalanceN = Number(data.totalBalanceFcfa);
    const availableBalance = Math.max(0, totalBalanceN - pendingDisbursementsAmount);

    return (
        <PageShell>
            <PageHeader
                title="Portefeuille de l'école"
                description="Comptes déclarés par l'école et soldes calculés sur les encaissements validés"
                breadcrumbs={[...walletBreadcrumbs]}
                actions={<Button icon="plus" onClick={() => setDeclareOpen(true)}>Déclarer un compte</Button>}
            />
            <DeclareAccountDialog open={declareOpen} onOpenChange={setDeclareOpen} onCreated={() => void mutate()} />

            <Card padding={14} style={{ border: "1px solid var(--eduflow-border-subtle)", background: "var(--eduflow-surface-sunken)" }}>
                <p style={{ margin: 0, fontSize: 13, color: "var(--eduflow-text-secondary)", lineHeight: 1.55 }}>
                    <strong>Comment le solde est calculé</strong> — solde d&apos;ouverture que vous déclarez, plus les
                    paiements validés dans EduPilot pour le canal du compte depuis sa déclaration (remboursements
                    déduits). EduPilot n&apos;est relié à aucune banque ni opérateur : rapprochez ce solde de vos relevés.
                </p>
            </Card>

            {!hasAccounts ? (
                <EmptyWalletState onDeclare={() => setDeclareOpen(true)} />
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
                        {data.transactions.length > 0 ? (
                            <TransactionsCard transactions={data.transactions} />
                        ) : (
                            <ReceiptsCard receipts={data.recentReceipts ?? []} />
                        )}

                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            <AccountsManageCard accounts={data.accounts} onChanged={() => void mutate()} />
                            {data.scheduledDisbursements.length > 0 ? (
                                <DisbursementsCard disbursements={data.scheduledDisbursements} />
                            ) : null}
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
                        grid-template-columns: minmax(0, 1fr) !important;
                    }
                }
            `}</style>
        </PageShell>
    );
}

function EmptyWalletState({ onDeclare }: { onDeclare: () => void }) {
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
            <h2
                className="eduflow-display"
                style={{ fontSize: 16, margin: "0 0 8px", color: "var(--eduflow-text-primary)" }}
            >
                Aucun compte déclaré
            </h2>
            <p
                style={{
                    fontSize: 13,
                    color: "var(--eduflow-text-secondary)",
                    maxWidth: 380,
                    lineHeight: 1.55,
                    margin: 0,
                }}
            >
                Déclarez les comptes de l&apos;école (banque, Mobile Money, caisse) avec leur solde
                d&apos;ouverture : les paiements validés dans EduPilot s&apos;y ajoutent automatiquement.
            </p>
            <div style={{ marginTop: 22 }}>
                <Button icon="plus" onClick={onDeclare}>Déclarer un compte</Button>
            </div>
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
                        const KindIcon = KIND_ICON[acc.kind];
                        return (
                            <div key={acc.id}>
                                <div style={{ marginBottom: 4 }} aria-hidden>
                                    <KindIcon size={18} strokeWidth={1.75} />
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 700 }}>{acc.name}</div>
                                <div style={{ fontSize: 11, opacity: 0.6 }}>
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
                    <h2 className="eduflow-display" style={{ fontSize: 16, margin: 0 }}>
                        Transactions en direct · auto-rapprochement
                    </h2>
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
                                                        fontSize: 11,
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
                                                    fontSize: 11,
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
            <p className="mb-2.5 text-[11px] font-semibold" style={{ color: "var(--eduflow-text-tertiary)" }}>Décaissements programmés · 48h</p>
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
                                    fontSize: 11,
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

const ACCOUNT_KIND_OPTIONS: { value: AccountKind; label: string }[] = [
    { value: "BANK", label: "Banque (virements, chèques)" },
    { value: "MTN", label: "MTN Mobile Money" },
    { value: "MOOV", label: "Moov Money" },
    { value: "CELTIIS", label: "Celtiis Cash" },
    { value: "CASH", label: "Caisse (espèces)" },
    { value: "OTHER", label: "Paiements en ligne" },
];

function fcfa(value: string | number | undefined) {
    return `${new Intl.NumberFormat("fr-FR").format(Math.round(Number(value ?? 0)))} FCFA`;
}

/** Déclarer un compte de l'école (POST /api/wallet/accounts). */
function DeclareAccountDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
    const [name, setName] = React.useState("");
    const [kind, setKind] = React.useState<AccountKind>("CASH");
    const [accountRef, setAccountRef] = React.useState("");
    const [opening, setOpening] = React.useState("0");
    const [busy, setBusy] = React.useState(false);
    const openingN = Number(opening.replace(/\s/g, ""));
    const invalid = name.trim().length < 2 || !Number.isInteger(openingN) || openingN < 0;

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (invalid) return;
        setBusy(true);
        try {
            const res = await fetch("/api/wallet/accounts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), kind, accountRef: accountRef.trim() || null, openingBalanceFcfa: openingN }),
            });
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                toast.error(body.error || "Le compte n'a pas été déclaré.");
                return;
            }
            toast.success("Compte déclaré.");
            setName("");
            setAccountRef("");
            setOpening("0");
            onOpenChange(false);
            onCreated();
        } catch {
            toast.error("Connexion impossible : le compte n'a pas été déclaré.");
        } finally {
            setBusy(false);
        }
    };

    const field = { height: 40, width: "100%", borderRadius: 8, border: "1px solid var(--eduflow-border-default)", padding: "0 12px", fontSize: 14 } as const;
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={submit} className="space-y-3">
                    <DialogHeader>
                        <DialogTitle>Déclarer un compte</DialogTitle>
                        <DialogDescription>Seuls les 4 derniers chiffres du numéro sont conservés.</DialogDescription>
                    </DialogHeader>
                    <label className="block text-sm">Nom du compte
                        <input style={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ex. Caisse principale" required />
                    </label>
                    <label className="block text-sm">Type
                        <select style={field} value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
                            {ACCOUNT_KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </label>
                    <label className="block text-sm">Numéro de compte ou de téléphone (facultatif)
                        <input style={field} value={accountRef} onChange={(e) => setAccountRef(e.target.value)} maxLength={40} inputMode="numeric" />
                    </label>
                    <label className="block text-sm">Solde d&apos;ouverture (FCFA)
                        <input style={field} value={opening} onChange={(e) => setOpening(e.target.value.replace(/[^0-9 ]/g, ""))} inputMode="numeric" />
                    </label>
                    <DialogFooter>
                        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>Annuler</Button>
                        <Button type="submit" disabled={invalid} loading={busy}>Déclarer</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** Comptes déclarés : détail du solde calculé, modification et suppression. */
function AccountsManageCard({ accounts, onChanged }: { accounts: AccountRow[]; onChanged: () => void }) {
    return (
        <Card>
            <p className="mb-2 text-xs font-semibold" style={{ color: "var(--eduflow-text-tertiary)" }}>Comptes déclarés</p>
            <ul className="space-y-3">
                {accounts.map((acc) => (
                    <li key={acc.id} className="rounded-lg border p-3" style={{ borderColor: "var(--eduflow-border-subtle)" }}>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-sm font-semibold">{acc.name}</span>
                            <span className="text-sm font-bold tabular-nums">{fcfa(acc.balanceFcfa)}</span>
                        </div>
                        <p className="mt-1 text-xs" style={{ color: "var(--eduflow-text-secondary)" }}>
                            Ouverture {fcfa(acc.openingBalanceFcfa)}
                            {acc.receivesPayments ? ` · + ${fcfa(acc.collectedFcfa)} encaissés depuis le ${acc.declaredAt ? new Date(acc.declaredAt).toLocaleDateString("fr-FR") : "—"}` : " · encaissements non rattachés (canal déjà suivi par un autre compte, ou sans paiement dans EduPilot)"}
                        </p>
                        <div className="mt-2">
                            <ResourceActions
                                endpoint={`/api/wallet/accounts/${acc.id}`}
                                resourceLabel={`Le compte « ${acc.name} »`}
                                fields={[
                                    { name: "name", label: "Nom", type: "text", required: true, maxLength: 80 },
                                    { name: "kind", label: "Type", type: "select", options: ACCOUNT_KIND_OPTIONS },
                                    { name: "accountRef", label: "Numéro (4 derniers chiffres conservés)", type: "text", maxLength: 40 },
                                    { name: "openingBalanceFcfa", label: "Solde d'ouverture (FCFA)", type: "number", required: true, min: 0, integer: true },
                                ]}
                                initial={{ name: acc.name, kind: acc.kind, accountRef: acc.accountRef, openingBalanceFcfa: Number(acc.openingBalanceFcfa ?? 0) }}
                                onChanged={onChanged}
                            />
                        </div>
                    </li>
                ))}
            </ul>
        </Card>
    );
}

const METHOD_LABEL: Record<string, string> = {
    CASH: "Espèces",
    MOBILE_MONEY_MTN: "MTN Mobile Money",
    MOBILE_MONEY_MOOV: "Moov Money",
    BANK_TRANSFER: "Virement",
    CHECK: "Chèque",
    OTHER: "Autre",
};

/** Derniers paiements validés de l'école : les entrées réelles de la caisse. */
function ReceiptsCard({ receipts }: { receipts: ReceiptRow[] }) {
    return (
        <Card>
            <p className="mb-2 text-xs font-semibold" style={{ color: "var(--eduflow-text-tertiary)" }}>Derniers encaissements validés</p>
            {receipts.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--eduflow-text-secondary)" }}>Aucun paiement validé pour l&apos;instant.</p>
            ) : (
                <ul className="divide-y" style={{ borderColor: "var(--eduflow-border-subtle)" }}>
                    {receipts.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                            <span>
                                <strong>{r.studentName}</strong>
                                <span style={{ color: "var(--eduflow-text-secondary)" }}>
                                    {" "}· {r.feeName ?? "Frais"} · {r.online ? "Paiement en ligne" : METHOD_LABEL[r.method] ?? r.method} · {new Date(r.occurredAt).toLocaleDateString("fr-FR")}
                                </span>
                            </span>
                            <span className={`font-semibold tabular-nums ${r.amountFcfa < 0 ? "text-destructive" : ""}`}>
                                {r.amountFcfa < 0 ? "Remboursement " : "+ "}{fcfa(Math.abs(r.amountFcfa))}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}
