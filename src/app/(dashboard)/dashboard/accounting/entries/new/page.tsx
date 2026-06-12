"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";
import { fetcher } from "@/lib/fetcher";

import { Badge, Button, Card, Icon, Input } from "@/components/edu";
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";

type AccountOption = {
    id: string;
    syscohadaCode: string;
    label: string;
    type: "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE" | "EQUITY";
};

type Line = {
    key: number;
    side: "debit" | "credit";
    accountId: string;
    amount: string;
    label: string;
};

const FR_NUMBER = new Intl.NumberFormat("fr-FR");

export default function NewJournalEntryPage() {
    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"]}
        >
            <NewJournalEntryContent />
        </PageGuard>
    );
}

function NewJournalEntryContent() {
    const router = useRouter();
    const { data: refData } = useSWR<{
        accounts: AccountOption[];
        fiscalYears: Array<{ id: string; label: string }>;
    }>("/api/accounting/entries?accounts=1", fetcher, { revalidateOnFocus: false });

    const accounts = refData?.accounts ?? [];
    const fiscalYears = refData?.fiscalYears ?? [];

    const [label, setLabel] = React.useState("");
    const [entryDate, setEntryDate] = React.useState(
        () => new Date().toISOString().slice(0, 10),
    );
    const [fiscalYearId, setFiscalYearId] = React.useState("");
    const [lines, setLines] = React.useState<Line[]>([
        { key: 1, side: "debit", accountId: "", amount: "", label: "" },
        { key: 2, side: "credit", accountId: "", amount: "", label: "" },
    ]);
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const totalDebit = lines
        .filter((l) => l.side === "debit")
        .reduce((s, l) => s + (Number(l.amount) || 0), 0);
    const totalCredit = lines
        .filter((l) => l.side === "credit")
        .reduce((s, l) => s + (Number(l.amount) || 0), 0);
    const balanced = totalDebit > 0 && totalDebit === totalCredit;

    function updateLine(key: number, patch: Partial<Line>) {
        setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    }

    function addLine(side: "debit" | "credit") {
        setLines((prev) => [
            ...prev,
            { key: Math.max(...prev.map((l) => l.key)) + 1, side, accountId: "", amount: "", label: "" },
        ]);
    }

    function removeLine(key: number) {
        setLines((prev) => (prev.length > 2 ? prev.filter((l) => l.key !== key) : prev));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        if (!balanced) {
            setError("L'écriture doit être équilibrée : Σ débits = Σ crédits > 0.");
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch("/api/accounting/entries", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fiscalYearId: fiscalYearId || undefined,
                    entryDate,
                    label,
                    lines: lines.map((l) => ({
                        debitAccountId: l.side === "debit" ? l.accountId : null,
                        creditAccountId: l.side === "credit" ? l.accountId : null,
                        amountFcfa: Number(l.amount),
                        label: l.label || undefined,
                    })),
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                setError(json.error ?? "Erreur lors de l'enregistrement.");
                return;
            }
            router.push("/dashboard/accounting");
        } catch {
            setError("Erreur réseau. Réessayez.");
        } finally {
            setSubmitting(false);
        }
    }

    const selectStyle: React.CSSProperties = {
        width: "100%",
        height: 36,
        borderRadius: 8,
        border: "1px solid var(--eduflow-border-default)",
        background: "var(--eduflow-surface-card)",
        color: "var(--eduflow-text-primary)",
        padding: "0 8px",
        fontSize: 12,
        fontFamily: "inherit",
    };

    const fieldLabel: React.CSSProperties = {
        fontSize: 11,
        fontWeight: 600,
        color: "var(--eduflow-text-tertiary)",
        marginBottom: 6,
        display: "block",
    };

    function renderLines(side: "debit" | "credit") {
        const sideLines = lines.filter((l) => l.side === side);
        const isDebit = side === "debit";
        return (
            <div>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 8,
                    }}
                >
                    <SubLabel>{isDebit ? "Débit" : "Crédit"}</SubLabel>
                    <span
                        className="tabular-nums"
                        style={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: isDebit
                                ? "var(--eduflow-danger-700)"
                                : "var(--eduflow-success-700)",
                        }}
                    >
                        {FR_NUMBER.format(isDebit ? totalDebit : totalCredit)} FCFA
                    </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {sideLines.map((l) => (
                        <div
                            key={l.key}
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1.6fr 1fr 28px",
                                gap: 8,
                                alignItems: "center",
                            }}
                        >
                            <select
                                aria-label={`Compte au ${isDebit ? "débit" : "crédit"}`}
                                value={l.accountId}
                                onChange={(e) => updateLine(l.key, { accountId: e.target.value })}
                                required
                                style={selectStyle}
                            >
                                <option value="">Compte SYSCOHADA…</option>
                                {accounts.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.syscohadaCode} · {a.label}
                                    </option>
                                ))}
                            </select>
                            <Input
                                type="number"
                                min="1"
                                value={l.amount}
                                onChange={(e) => updateLine(l.key, { amount: e.target.value })}
                                placeholder="Montant"
                                aria-label="Montant en FCFA"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => removeLine(l.key)}
                                disabled={lines.length <= 2}
                                aria-label="Supprimer la ligne"
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 8,
                                    border: "1px solid var(--eduflow-border-default)",
                                    background: "var(--eduflow-surface-card)",
                                    cursor: lines.length > 2 ? "pointer" : "not-allowed",
                                    display: "grid",
                                    placeItems: "center",
                                    opacity: lines.length > 2 ? 1 : 0.4,
                                }}
                            >
                                <Icon name="x" size={12} color="var(--eduflow-text-tertiary)" />
                            </button>
                        </div>
                    ))}
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon="plus"
                    onClick={() => addLine(side)}
                    style={{ marginTop: 8 }}
                >
                    Ajouter une ligne {isDebit ? "débit" : "crédit"}
                </Button>
            </div>
        );
    }

    return (
        <div className="eduflow-scope mx-auto flex max-w-4xl flex-col gap-4 pb-12">
            <PageHeader
                greeting="Nouvelle écriture comptable"
                sub="Partie double SYSCOHADA · l'écriture doit être équilibrée avant validation."
                breadcrumb={["Administration", "Finance", "Comptabilité", "Nouvelle écriture"]}
                actions={
                    <Badge
                        variant={balanced ? "success" : "warning"}
                        icon={balanced ? "check" : undefined}
                    >
                        {balanced
                            ? "Équilibrée"
                            : `Écart : ${FR_NUMBER.format(Math.abs(totalDebit - totalCredit))} FCFA`}
                    </Badge>
                }
            />

            <form onSubmit={handleSubmit}>
                <Card padding={24}>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "2fr 1fr 1fr",
                            gap: 14,
                            marginBottom: 24,
                        }}
                    >
                        <div>
                            <label htmlFor="je-label" style={fieldLabel}>
                                Libellé de l&apos;écriture *
                            </label>
                            <Input
                                id="je-label"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                placeholder="Ex : Salaire juin · M. Adjavon"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="je-date" style={fieldLabel}>
                                Date *
                            </label>
                            <Input
                                id="je-date"
                                type="date"
                                value={entryDate}
                                onChange={(e) => setEntryDate(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="je-fy" style={fieldLabel}>
                                Exercice
                            </label>
                            <select
                                id="je-fy"
                                value={fiscalYearId}
                                onChange={(e) => setFiscalYearId(e.target.value)}
                                style={{ ...selectStyle, height: 38 }}
                            >
                                <option value="">Exercice ouvert courant</option>
                                {fiscalYears.map((fy) => (
                                    <option key={fy.id} value={fy.id}>
                                        {fy.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                        {renderLines("debit")}
                        {renderLines("credit")}
                    </div>

                    {error ? (
                        <div role="alert" style={{ marginTop: 16 }}>
                            <Badge variant="danger">{error}</Badge>
                        </div>
                    ) : null}

                    <div
                        style={{
                            display: "flex",
                            gap: 8,
                            justifyContent: "flex-end",
                            marginTop: 20,
                            paddingTop: 16,
                            borderTop: "1px solid var(--eduflow-border-subtle)",
                        }}
                    >
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => router.push("/dashboard/accounting")}
                        >
                            Annuler
                        </Button>
                        <Button type="submit" icon="check" loading={submitting} disabled={!balanced}>
                            Comptabiliser l&apos;écriture
                        </Button>
                    </div>
                </Card>
            </form>
        </div>
    );
}
