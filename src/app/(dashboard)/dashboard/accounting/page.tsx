"use client";

import * as React from "react";
import useSWR from "swr";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";
import { fetcher } from "@/lib/fetcher";

import { Avatar, Badge, Button, Card, Chip, Icon } from "@/components/edu";
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";

type JournalLine = {
    id: string;
    amountFcfa: string;
    label: string | null;
    debit: { code: string; label: string } | null;
    credit: { code: string; label: string } | null;
};

type JournalEntryRow = {
    id: string;
    pieceRef: string;
    entryDate: string;
    label: string;
    lines: JournalLine[];
};

type ExpenseAccount = {
    code: string;
    label: string;
    balanceFcfa: string;
    pct: number;
};

type AccountingOverview = {
    schoolId: string;
    fiscalYear: { id: string; label: string; status: "OPEN" | "CLOSED" } | null;
    kpis: {
        cashBalanceFcfa: string;
        bankBalanceFcfa: string;
        momoBalanceFcfa: string;
        exerciseResultFcfa: string;
        journalEntryCount: number;
    };
    journalEntries: JournalEntryRow[];
    expenseAccounts: ExpenseAccount[];
    expenseTotalFcfa: string;
};

const FR_NUMBER = new Intl.NumberFormat("fr-FR");
const FR_DATE_SHORT = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
});

const EXPENSE_TONES: Array<"brand" | "info" | "warning" | "success" | "danger" | "neutral"> = [
    "brand",
    "info",
    "warning",
    "success",
    "danger",
    "neutral",
];

// Static DGI deadlines — fiscal calendar, not driven by transactional data.
const DGI_DEADLINES: { label: string; when: string; tone: "danger" | "warning" | "info" }[] = [
    { label: "Déclaration TVA · mai", when: "15 juin", tone: "warning" },
    { label: "Acompte IS · trim 2", when: "15 juin", tone: "warning" },
    { label: "CNSS · cotisations mai", when: "30 mai", tone: "danger" },
    { label: "Patente municipale", when: "31 juil.", tone: "info" },
];

function fmtMillions(value: string | bigint | number): string {
    const n = typeof value === "bigint" ? Number(value) : Number(value);
    const sign = n < 0 ? "−" : "";
    const abs = Math.abs(n);
    if (abs >= 1_000_000) {
        return `${sign}${(abs / 1_000_000).toFixed(1).replace(".", ",")}`;
    }
    if (abs >= 1_000) {
        return `${sign}${Math.round(abs / 1000)} k`;
    }
    return FR_NUMBER.format(n);
}

function fmtFcfa(value: string | bigint | number): string {
    const n = typeof value === "bigint" ? Number(value) : Number(value);
    return FR_NUMBER.format(n);
}

function signedResultPrefix(n: number): string {
    return n > 0 ? "+" : n < 0 ? "−" : "";
}

export default function AccountingPage() {
    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"]}
        >
            <AccountingPageContent />
        </PageGuard>
    );
}

function AccountingPageContent() {
    const { data, error, isLoading } = useSWR<AccountingOverview>(
        "/api/accounting/overview",
        fetcher,
        { revalidateOnFocus: false },
    );

    if (isLoading) {
        return (
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <PageHeader
                    greeting="Comptabilité OHADA"
                    sub="Chargement de l'exercice…"
                    breadcrumb={["Administration", "Finance", "Comptabilité"]}
                />
                <div
                    style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}
                    className="kpi-grid"
                >
                    {[0, 1, 2, 3].map((i) => (
                        <Card key={i} padding={16} style={{ minHeight: 100 }}>
                            <div
                                className="animate-pulse"
                                style={{
                                    height: 28,
                                    width: "70%",
                                    background: "var(--eduflow-neutral-200)",
                                    borderRadius: 4,
                                }}
                            />
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <PageHeader
                    greeting="Comptabilité OHADA"
                    sub="Impossible de charger l'exercice"
                    breadcrumb={["Administration", "Finance", "Comptabilité"]}
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
                        Le service comptabilité est momentanément indisponible.
                    </p>
                </Card>
            </div>
        );
    }

    const hasFiscalYear = data.fiscalYear !== null;
    const hasJournalEntries = data.journalEntries.length > 0;
    const fiscalLabel = data.fiscalYear?.label ?? "—";

    const resultN = Number(data.kpis.exerciseResultFcfa);
    const resultTone: "success" | "warning" | "danger" =
        resultN >= 0 ? "success" : "danger";

    return (
        <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
            <PageHeader
                greeting={`Comptabilité OHADA · exercice ${fiscalLabel}`}
                sub="Plan SYSCOHADA révisé · clôture mensuelle · export DGI · réviseur Cabinet Aïvodji"
                breadcrumb={["Administration", "Finance", "Comptabilité"]}
                actions={
                    <>
                        <Badge variant="success" icon="check">
                            Conforme SYSCOHADA
                        </Badge>
                        <Button
                            variant="secondary"
                            icon="download"
                            onClick={() => {
                                const url = data?.fiscalYear?.id
                                    ? `/api/accounting/export?fiscalYearId=${data.fiscalYear.id}&format=itas`
                                    : "/api/accounting/export?format=itas";
                                window.open(url, "_blank");
                            }}
                            disabled={!hasFiscalYear}
                            title={hasFiscalYear ? "Télécharger l'export DGI iTAS (CSV SYSCOHADA)" : "Aucun exercice fiscal actif"}
                        >
                            Export DGI · iTAS
                        </Button>
                        <Button icon="plus" disabled title="Création écriture — module expert à venir">
                            Nouvelle écriture
                        </Button>
                    </>
                }
            />

            {!hasFiscalYear ? (
                <EmptyAccountingState />
            ) : (
                <>
                    <div
                        style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}
                        className="kpi-grid"
                    >
                        <Kpi
                            label="Caisse · espèces"
                            value={fmtMillions(data.kpis.cashBalanceFcfa)}
                            unit="M FCFA"
                            hint="Plan 57 · rapprochement quotidien"
                            tone="warning"
                        />
                        <Kpi
                            label="Banques"
                            value={fmtMillions(data.kpis.bankBalanceFcfa)}
                            unit="M FCFA"
                            hint="Plan 52 · Ecobank / BoA"
                            tone="brand"
                        />
                        <Kpi
                            label="Mobile Money"
                            value={fmtMillions(data.kpis.momoBalanceFcfa)}
                            unit="M FCFA"
                            hint="Plan 53 · MTN · Moov · Celtiis"
                            tone="success"
                        />
                        <Kpi
                            label="Résultat exercice"
                            value={`${signedResultPrefix(resultN)}${fmtMillions(Math.abs(resultN))}`}
                            unit="M FCFA"
                            hint={`Cumul ${fiscalLabel}`}
                            tone={resultTone}
                            big
                        />
                    </div>

                    <div
                        style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14 }}
                        className="acc-grid"
                    >
                        <JournalCard
                            entries={data.journalEntries}
                            total={data.kpis.journalEntryCount}
                            hasEntries={hasJournalEntries}
                        />

                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            <ExpensesCard
                                expenses={data.expenseAccounts}
                                totalFcfa={data.expenseTotalFcfa}
                            />
                            <DeadlinesCard />
                            <AuditorCard />
                        </div>
                    </div>
                </>
            )}

            <style jsx global>{`
                @media (max-width: 960px) {
                    .kpi-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                    .acc-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div>
    );
}

function EmptyAccountingState() {
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
            <h3 className="eduflow-display" style={{ fontSize: 18, margin: "0 0 8px" }}>
                Aucun exercice comptable ouvert
            </h3>
            <p
                style={{
                    fontSize: 13,
                    color: "var(--eduflow-text-secondary)",
                    maxWidth: 420,
                    lineHeight: 1.55,
                    margin: 0,
                }}
            >
                Ouvrez l&apos;exercice fiscal (ex. 2025-2026) et chargez le plan comptable
                SYSCOHADA pour démarrer la tenue de comptabilité. Les écritures sont ensuite
                générées automatiquement depuis les paiements scolarité et les décaissements
                Wallet.
            </p>
        </Card>
    );
}

function Kpi({
    label,
    value,
    unit,
    hint,
    tone = "brand",
    big = false,
}: {
    label: string;
    value: string;
    unit?: string;
    hint?: string;
    tone?: "brand" | "info" | "success" | "warning" | "danger";
    big?: boolean;
}) {
    return (
        <div
            style={{
                padding: big ? 20 : 16,
                borderRadius: 14,
                background: `var(--${tone}-50)`,
                border: `1px solid var(--${tone}-200)`,
            }}
        >
            <div
                style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: `var(--${tone}-700)`,
                }}
            >
                {label}
            </div>
            <div
                className="eduflow-display tabular"
                style={{
                    fontSize: big ? 38 : 28,
                    fontWeight: 800,
                    color: `var(--${tone}-900)`,
                    marginTop: 4,
                    lineHeight: 1,
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {value}
                {unit ? (
                    <span
                        style={{
                            fontSize: big ? 14 : 12,
                            fontWeight: 600,
                            color: `var(--${tone}-700)`,
                            marginLeft: 4,
                        }}
                    >
                        {unit}
                    </span>
                ) : null}
            </div>
            {hint ? (
                <div
                    style={{
                        fontSize: 11,
                        color: `var(--${tone}-800)`,
                        marginTop: 6,
                        lineHeight: 1.5,
                    }}
                >
                    {hint}
                </div>
            ) : null}
        </div>
    );
}

function JournalCard({
    entries,
    total,
    hasEntries,
}: {
    entries: JournalEntryRow[];
    total: number;
    hasEntries: boolean;
}) {
    // Compute period totals
    const totals = React.useMemo(() => {
        let debit = 0;
        let credit = 0;
        for (const e of entries) {
            for (const l of e.lines) {
                if (l.debit) debit += Number(l.amountFcfa);
                if (l.credit) credit += Number(l.amountFcfa);
            }
        }
        return { debit, credit };
    }, [entries]);

    // Flatten lines for table render (one row per line for readability)
    const flatRows = React.useMemo(
        () =>
            entries.flatMap((e) =>
                e.lines.map((l) => ({
                    entry: e,
                    line: l,
                })),
            ),
        [entries],
    );

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
                        Journal des opérations
                    </h3>
                    <p
                        style={{
                            fontSize: 11,
                            color: "var(--text-tertiary)",
                            margin: "2px 0 0",
                        }}
                    >
                        {total} écriture{total > 1 ? "s" : ""} validée{total > 1 ? "s" : ""} ·
                        auto-équilibré
                    </p>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Chip active>Tous</Chip>
                </div>
            </div>
            {!hasEntries ? (
                <div
                    style={{
                        padding: "48px 24px",
                        textAlign: "center",
                        color: "var(--eduflow-text-tertiary)",
                        fontSize: 13,
                    }}
                >
                    Aucune écriture comptable sur cet exercice.
                </div>
            ) : (
                <div style={{ overflowX: "auto" }}>
                    <table
                        style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: 12,
                        }}
                    >
                        <thead>
                            <tr style={{ background: "var(--surface-sunken)" }}>
                                {[
                                    "Date",
                                    "N° pièce",
                                    "Compte SYSCOHADA",
                                    "Libellé",
                                    "Débit",
                                    "Crédit",
                                ].map((h) => (
                                    <th
                                        key={h}
                                        style={{
                                            padding: "10px 14px",
                                            textAlign:
                                                h === "Débit" || h === "Crédit" ? "right" : "left",
                                            fontSize: 10,
                                            fontWeight: 700,
                                            color: "var(--text-tertiary)",
                                            letterSpacing: "0.06em",
                                            textTransform: "uppercase",
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {flatRows.map(({ entry, line }, i) => {
                                const account = line.debit ?? line.credit;
                                return (
                                    <tr
                                        key={line.id}
                                        style={{
                                            borderTop: i > 0 ? "1px solid var(--border-subtle)" : 0,
                                        }}
                                    >
                                        <td
                                            style={{
                                                padding: "10px 14px",
                                                fontFamily:
                                                    "var(--eduflow-font-mono, monospace)",
                                                fontSize: 11,
                                                color: "var(--text-tertiary)",
                                            }}
                                        >
                                            {FR_DATE_SHORT.format(new Date(entry.entryDate))}
                                        </td>
                                        <td
                                            style={{
                                                padding: "10px 14px",
                                                fontFamily:
                                                    "var(--eduflow-font-mono, monospace)",
                                                fontSize: 11,
                                                color: "var(--brand-700)",
                                                fontWeight: 600,
                                            }}
                                        >
                                            {entry.pieceRef}
                                        </td>
                                        <td style={{ padding: "10px 14px", fontSize: 11 }}>
                                            {account ? (
                                                <>
                                                    <span
                                                        style={{
                                                            fontFamily:
                                                                "var(--eduflow-font-mono, monospace)",
                                                            fontWeight: 700,
                                                            marginRight: 4,
                                                        }}
                                                    >
                                                        {account.code}
                                                    </span>
                                                    <span
                                                        style={{
                                                            color: "var(--text-tertiary)",
                                                        }}
                                                    >
                                                        {account.label}
                                                    </span>
                                                </>
                                            ) : (
                                                <span style={{ color: "var(--text-tertiary)" }}>—</span>
                                            )}
                                        </td>
                                        <td
                                            style={{
                                                padding: "10px 14px",
                                                color: "var(--text-secondary)",
                                            }}
                                        >
                                            {line.label ?? entry.label}
                                        </td>
                                        <td
                                            className="tabular"
                                            style={{
                                                padding: "10px 14px",
                                                textAlign: "right",
                                                fontVariantNumeric: "tabular-nums",
                                            }}
                                        >
                                            {line.debit ? (
                                                <span
                                                    style={{
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                        color: "var(--danger-700)",
                                                    }}
                                                >
                                                    {fmtFcfa(line.amountFcfa)}
                                                </span>
                                            ) : null}
                                        </td>
                                        <td
                                            className="tabular"
                                            style={{
                                                padding: "10px 14px",
                                                textAlign: "right",
                                                fontVariantNumeric: "tabular-nums",
                                            }}
                                        >
                                            {line.credit ? (
                                                <span
                                                    style={{
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                        color: "var(--success-700)",
                                                    }}
                                                >
                                                    {fmtFcfa(line.amountFcfa)}
                                                </span>
                                            ) : null}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr
                                style={{
                                    background: "var(--surface-sunken)",
                                    borderTop: "2px solid var(--brand-600)",
                                }}
                            >
                                <td
                                    colSpan={4}
                                    style={{
                                        padding: "12px 14px",
                                        fontWeight: 700,
                                        fontSize: 11,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.08em",
                                        color: "var(--text-secondary)",
                                    }}
                                >
                                    Totaux période affichée
                                </td>
                                <td
                                    className="tabular eduflow-display"
                                    style={{
                                        padding: "12px 14px",
                                        textAlign: "right",
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 14,
                                            fontWeight: 800,
                                            color: "var(--danger-700)",
                                        }}
                                    >
                                        {fmtMillions(totals.debit)} M
                                    </span>
                                </td>
                                <td
                                    className="tabular eduflow-display"
                                    style={{
                                        padding: "12px 14px",
                                        textAlign: "right",
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 14,
                                            fontWeight: 800,
                                            color: "var(--success-700)",
                                        }}
                                    >
                                        {fmtMillions(totals.credit)} M
                                    </span>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </Card>
    );
}

function ExpensesCard({
    expenses,
    totalFcfa,
}: {
    expenses: ExpenseAccount[];
    totalFcfa: string;
}) {
    return (
        <Card padding={0}>
            <div
                style={{
                    padding: "14px 18px",
                    borderBottom: "1px solid var(--border-subtle)",
                }}
            >
                <h3 className="eduflow-display" style={{ fontSize: 15, margin: 0 }}>
                    Postes principaux · charges
                </h3>
                <p
                    style={{
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                        margin: "2px 0 0",
                    }}
                >
                    Cumul exercice · {fmtMillions(totalFcfa)} M FCFA
                </p>
            </div>
            <div
                style={{
                    padding: 18,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                }}
            >
                {expenses.length === 0 ? (
                    <p style={{ fontSize: 12, color: "var(--eduflow-text-tertiary)" }}>
                        Aucune charge enregistrée.
                    </p>
                ) : (
                    expenses.map((p, idx) => {
                        const tone = EXPENSE_TONES[idx % EXPENSE_TONES.length];
                        const fillColor =
                            tone === "neutral"
                                ? "var(--neutral-500)"
                                : `var(--${tone}-600)`;
                        return (
                            <div key={p.code}>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "baseline",
                                        marginBottom: 4,
                                    }}
                                >
                                    <span
                                        style={{
                                            width: 40,
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: "var(--text-tertiary)",
                                            fontFamily:
                                                "var(--eduflow-font-mono, monospace)",
                                        }}
                                    >
                                        {p.code}
                                    </span>
                                    <span
                                        style={{
                                            flex: 1,
                                            fontSize: 12,
                                            fontWeight: 600,
                                        }}
                                    >
                                        {p.label}
                                    </span>
                                    <span
                                        className="tabular eduflow-display"
                                        style={{
                                            fontSize: 13,
                                            fontWeight: 700,
                                            fontVariantNumeric: "tabular-nums",
                                        }}
                                    >
                                        {fmtMillions(p.balanceFcfa)} M
                                    </span>
                                </div>
                                <div
                                    style={{
                                        height: 6,
                                        background: "var(--neutral-100)",
                                        borderRadius: 3,
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            height: "100%",
                                            width: `${p.pct}%`,
                                            background: fillColor,
                                            borderRadius: 3,
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </Card>
    );
}

function DeadlinesCard() {
    return (
        <Card
            padding={16}
            style={{
                background: "var(--brand-50)",
                border: "1px solid var(--brand-200)",
            }}
        >
            <SubLabel>Échéances DGI · à venir</SubLabel>
            <div
                style={{
                    marginTop: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                }}
            >
                {DGI_DEADLINES.map((e, i) => (
                    <div
                        key={e.label}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "6px 0",
                            borderTop:
                                i > 0 ? "1px solid var(--brand-200)" : 0,
                        }}
                    >
                        <span
                            aria-hidden
                            style={{
                                width: 6,
                                height: 6,
                                borderRadius: 3,
                                background: `var(--${e.tone}-600)`,
                            }}
                        />
                        <span
                            style={{
                                flex: 1,
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--brand-900)",
                            }}
                        >
                            {e.label}
                        </span>
                        <Badge variant={e.tone} size="sm">
                            {e.when}
                        </Badge>
                    </div>
                ))}
            </div>
        </Card>
    );
}

function AuditorCard() {
    return (
        <Card padding={16}>
            <SubLabel>Réviseur comptable</SubLabel>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 8,
                }}
            >
                <Avatar name="Cabinet Aïvodji" size="md" />
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                        Cabinet Aïvodji &amp; Associés
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                        Mission audit · ord. exp. comp. Bénin
                    </div>
                </div>
                <Badge variant="success" size="sm" dot>
                    Live
                </Badge>
            </div>
            <Button
                variant="secondary"
                size="sm"
                full
                style={{ marginTop: 12 }}
                icon="sms"
                disabled
                title="Envoi messagerie professionnel à venir"
            >
                Envoyer le journal
            </Button>
        </Card>
    );
}
