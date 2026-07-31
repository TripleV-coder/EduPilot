"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading, PageError } from "@/components/layout/page-states";
import { Badge, Button, Card, Icon } from "@/components/edu";
import { STAFF_MEMBER_ROLES, computePayrollNet, type AmountLine } from "@/lib/staff/hr";
import { formatUserRoleLabel } from "@/lib/utils/role-label";

type PayrollStatus = "DRAFT" | "VALIDATED" | "PAID";

interface PayrollEntry {
    id: string;
    userId: string;
    name: string;
    role: string;
    baseSalary: number;
    allowances: AmountLine[];
    deductions: AmountLine[];
    netAmount: number;
    status: PayrollStatus;
    paidAt: string | null;
    journalEntryId: string | null;
}
interface PayrollResponse {
    period: string;
    canManage: boolean;
    entries: PayrollEntry[];
}
interface StaffResponse {
    staff: { userId: string; name: string; role: string }[];
}

const STATUS_META: Record<PayrollStatus, { label: string; variant: "neutral" | "warning" | "success" }> = {
    DRAFT: { label: "Brouillon", variant: "neutral" },
    VALIDATED: { label: "Validé", variant: "warning" },
    PAID: { label: "Payé", variant: "success" },
};

function currentPeriod(): string {
    return new Date().toISOString().slice(0, 7);
}
function fcfa(n: number): string {
    return `${new Intl.NumberFormat("fr-FR").format(n)} FCFA`;
}

async function downloadPayslip(entry: PayrollEntry, period: string) {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Bulletin de paie", 14, 20);
    doc.setFontSize(11);
    doc.text(`Agent : ${entry.name} (${formatUserRoleLabel(entry.role)})`, 14, 30);
    doc.text(`Période : ${period}`, 14, 37);
    const rows: [string, string][] = [
        ["Salaire de base", fcfa(entry.baseSalary)],
        ...entry.allowances.map((a): [string, string] => [`Prime — ${a.label}`, fcfa(a.amount)]),
        ...entry.deductions.map((d): [string, string] => [`Retenue — ${d.label}`, `− ${fcfa(d.amount)}`]),
        ["Net à payer", fcfa(entry.netAmount)],
    ];
    autoTable(doc, {
        startY: 45,
        head: [["Rubrique", "Montant"]],
        body: rows,
        theme: "grid",
        headStyles: { fillColor: [37, 99, 235] },
    });
    doc.save(`bulletin-paie-${entry.name.replace(/\s+/g, "-")}-${period}.pdf`);
}

interface EditorState {
    userId: string;
    name: string;
    baseSalary: number;
    allowances: AmountLine[];
    deductions: AmountLine[];
}

function PayrollContent() {
    const [period, setPeriod] = useState(currentPeriod());
    const { data, error, isLoading, mutate } = useSWR<PayrollResponse>(
        `/api/staff/payroll?period=${period}`,
        fetcher,
    );
    const canManage = data?.canManage ?? false;
    const { data: staffData } = useSWR<StaffResponse>(canManage ? "/api/staff" : null, fetcher);

    const [editor, setEditor] = useState<EditorState | null>(null);
    const [saving, setSaving] = useState(false);

    const entriesByUser = useMemo(
        () => new Map((data?.entries ?? []).map((e) => [e.userId, e])),
        [data],
    );

    const editorNet = editor
        ? computePayrollNet(editor.baseSalary, editor.allowances, editor.deductions)
        : 0;

    function openEditor(userId: string, name: string) {
        const existing = entriesByUser.get(userId);
        setEditor({
            userId,
            name,
            baseSalary: existing?.baseSalary ?? 0,
            allowances: existing?.allowances ?? [],
            deductions: existing?.deductions ?? [],
        });
    }

    async function saveEditor() {
        if (!editor) return;
        setSaving(true);
        try {
            const res = await fetch("/api/staff/payroll", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: editor.userId,
                    period,
                    baseSalary: Math.max(0, Math.round(editor.baseSalary || 0)),
                    allowances: editor.allowances.filter((a) => a.label.trim() && a.amount > 0),
                    deductions: editor.deductions.filter((d) => d.label.trim() && d.amount > 0),
                }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => null);
                throw new Error(j?.error);
            }
            toast.success("Fiche de paie enregistrée.");
            setEditor(null);
            await mutate();
        } catch (e) {
            toast.error(e instanceof Error && e.message ? e.message : "Échec de l'enregistrement.");
        } finally {
            setSaving(false);
        }
    }

    async function payrollAction(id: string, action: "validate" | "pay") {
        try {
            const res = await fetch(`/api/staff/payroll/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => null);
                throw new Error(j?.error);
            }
            toast.success(action === "validate" ? "Fiche validée (écriture comptable générée)." : "Paiement enregistré.");
            await mutate();
        } catch (e) {
            toast.error(e instanceof Error && e.message ? e.message : "Action impossible.");
        }
    }

    if (isLoading) return <PageLoading label="Chargement de la paie…" />;
    if (error) return <PageError message="Impossible de charger la paie du personnel." />;
    if (!data) return null;

    // Vue employé : ses propres fiches.
    if (!canManage) {
        return (
            <div className="space-y-4">
                <PeriodPicker period={period} setPeriod={setPeriod} />
                <Card padding={0}>
                    {data.entries.length === 0 ? (
                        <p className="px-5 py-8 text-center" style={{ fontSize: 13, color: "var(--eduflow-text-tertiary)" }}>
                            Aucune fiche de paie pour cette période.
                        </p>
                    ) : (
                        <ul className="divide-y" style={{ borderColor: "var(--eduflow-border-subtle)" }}>
                            {data.entries.map((e) => (
                                <li key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                                    <div className="flex-1" style={{ fontSize: 14, fontWeight: 600 }}>{fcfa(e.netAmount)}</div>
                                    <Badge variant={STATUS_META[e.status].variant} size="sm">{STATUS_META[e.status].label}</Badge>
                                    {e.status !== "DRAFT" ? (
                                        <Button variant="ghost" size="sm" icon="download" onClick={() => downloadPayslip(e, period)}>Bulletin</Button>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>
        );
    }

    // Vue gestionnaire : personnel × fiches.
    const roster = staffData?.staff ?? [];
    const total = data.entries.reduce((acc, e) => acc + e.netAmount, 0);

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <PeriodPicker period={period} setPeriod={setPeriod} />
                <div style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                    Masse salariale (net) : <strong>{fcfa(total)}</strong>
                </div>
            </div>

            <Card padding={0}>
                <ul className="divide-y" style={{ borderColor: "var(--eduflow-border-subtle)" }}>
                    {roster.map((s) => {
                        const entry = entriesByUser.get(s.userId);
                        return (
                            <li key={s.userId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                                <div className="min-w-0 flex-1">
                                    <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                                    <div style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>{formatUserRoleLabel(s.role)}</div>
                                </div>
                                {entry ? (
                                    <>
                                        <div style={{ fontSize: 14, fontWeight: 600, minWidth: 120, textAlign: "right" }}>{fcfa(entry.netAmount)}</div>
                                        <Badge variant={STATUS_META[entry.status].variant} size="sm">{STATUS_META[entry.status].label}</Badge>
                                        {entry.status === "DRAFT" ? (
                                            <>
                                                <Button variant="ghost" size="sm" icon="pencil" onClick={() => openEditor(s.userId, s.name)}>Éditer</Button>
                                                <Button variant="secondary" size="sm" icon="check" onClick={() => payrollAction(entry.id, "validate")}>Valider</Button>
                                            </>
                                        ) : entry.status === "VALIDATED" ? (
                                            <>
                                                <Button variant="ghost" size="sm" icon="download" onClick={() => downloadPayslip(entry, period)}>Bulletin</Button>
                                                <Button variant="secondary" size="sm" icon="money" onClick={() => payrollAction(entry.id, "pay")}>Payer</Button>
                                            </>
                                        ) : (
                                            <Button variant="ghost" size="sm" icon="download" onClick={() => downloadPayslip(entry, period)}>Bulletin</Button>
                                        )}
                                    </>
                                ) : (
                                    <Button variant="ghost" size="sm" icon="plus" onClick={() => openEditor(s.userId, s.name)}>Configurer</Button>
                                )}
                            </li>
                        );
                    })}
                    {roster.length === 0 ? (
                        <li className="px-5 py-8 text-center" style={{ fontSize: 13, color: "var(--eduflow-text-tertiary)" }}>
                            Aucun membre du personnel.
                        </li>
                    ) : null}
                </ul>
            </Card>

            {editor ? (
                <PayrollEditor
                    editor={editor}
                    net={editorNet}
                    saving={saving}
                    onChange={setEditor}
                    onSave={saveEditor}
                    onClose={() => setEditor(null)}
                />
            ) : null}
        </div>
    );
}

function PeriodPicker({ period, setPeriod }: { period: string; setPeriod: (p: string) => void }) {
    return (
        <label className="flex flex-col gap-1">
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--eduflow-text-tertiary)" }}>Période</span>
            <input
                type="month"
                value={period}
                max={currentPeriod()}
                onChange={(e) => setPeriod(e.target.value)}
                style={{
                    height: 40, padding: "0 12px", borderRadius: "var(--eduflow-radius-input)",
                    border: "1px solid var(--eduflow-border-default)", background: "var(--eduflow-surface-card)",
                    fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "var(--eduflow-text-primary)",
                }}
            />
        </label>
    );
}

function PayrollEditor({
    editor, net, saving, onChange, onSave, onClose,
}: {
    editor: EditorState;
    net: number;
    saving: boolean;
    onChange: (e: EditorState) => void;
    onSave: () => void;
    onClose: () => void;
}) {
    const update = (patch: Partial<EditorState>) => onChange({ ...editor, ...patch });
    const editLine = (key: "allowances" | "deductions", i: number, patch: Partial<AmountLine>) =>
        update({ [key]: editor[key].map((l, idx) => (idx === i ? { ...l, ...patch } : l)) } as Partial<EditorState>);
    const addLine = (key: "allowances" | "deductions") =>
        update({ [key]: [...editor[key], { label: "", amount: 0 }] } as Partial<EditorState>);
    const removeLine = (key: "allowances" | "deductions", i: number) =>
        update({ [key]: editor[key].filter((_, idx) => idx !== i) } as Partial<EditorState>);

    return (
        <Card padding={0}>
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--eduflow-border-subtle)" }}>
                <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>Fiche de paie — {editor.name}</h3>
                <button type="button" onClick={onClose} aria-label="Fermer"><Icon name="x" size={18} /></button>
            </div>
            <div className="space-y-4 px-5 py-5">
                <label className="flex flex-col gap-1" style={{ maxWidth: 240 }}>
                    <span style={editorLabel}>Salaire de base (FCFA)</span>
                    <input type="number" min={0} value={editor.baseSalary} onChange={(e) => update({ baseSalary: Number(e.target.value) })} style={editorInput} />
                </label>

                <LineEditor title="Primes / indemnités" lines={editor.allowances} onEdit={(i, p) => editLine("allowances", i, p)} onAdd={() => addLine("allowances")} onRemove={(i) => removeLine("allowances", i)} />
                <LineEditor title="Retenues" lines={editor.deductions} onEdit={(i, p) => editLine("deductions", i, p)} onAdd={() => addLine("deductions")} onRemove={(i) => removeLine("deductions", i)} />

                <div className="flex items-center justify-between border-t pt-4" style={{ borderColor: "var(--eduflow-border-subtle)" }}>
                    <div style={{ fontSize: 15 }}>Net à payer : <strong>{fcfa(net)}</strong></div>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={onClose}>Annuler</Button>
                        <Button icon="check" loading={saving} onClick={onSave}>Enregistrer</Button>
                    </div>
                </div>
            </div>
        </Card>
    );
}

function LineEditor({
    title, lines, onEdit, onAdd, onRemove,
}: {
    title: string;
    lines: AmountLine[];
    onEdit: (i: number, patch: Partial<AmountLine>) => void;
    onAdd: () => void;
    onRemove: (i: number) => void;
}) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span style={editorLabel}>{title}</span>
                <Button variant="ghost" size="sm" icon="plus" onClick={onAdd}>Ajouter</Button>
            </div>
            {lines.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                    <input type="text" placeholder="Libellé" value={l.label} onChange={(e) => onEdit(i, { label: e.target.value })} style={{ ...editorInput, flex: 1 }} />
                    <input type="number" min={0} placeholder="Montant" value={l.amount} onChange={(e) => onEdit(i, { amount: Number(e.target.value) })} style={{ ...editorInput, width: 140 }} />
                    <button type="button" onClick={() => onRemove(i)} aria-label="Supprimer la ligne"><Icon name="x" size={16} color="var(--eduflow-danger-600)" /></button>
                </div>
            ))}
        </div>
    );
}

const editorLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--eduflow-text-tertiary)" };
const editorInput: React.CSSProperties = {
    height: 40, padding: "0 12px", borderRadius: "var(--eduflow-radius-input)",
    border: "1px solid var(--eduflow-border-default)", background: "var(--eduflow-surface-card)",
    fontFamily: "inherit", fontSize: 13, color: "var(--eduflow-text-primary)",
};

export default function StaffPayrollPage() {
    return (
        <PageGuard roles={[...STAFF_MEMBER_ROLES]}>
            <PageShell className="max-w-4xl pb-12">
                <PageHeader
                    title="Paie du personnel"
                    description="Établis les fiches de paie, valide-les (écriture OHADA) et édite les bulletins."
                    breadcrumbs={[
                        { label: "Personnel", href: "/dashboard/staff" },
                        { label: "Paie" },
                    ]}
                />
                <PayrollContent />
            </PageShell>
        </PageGuard>
    );
}
