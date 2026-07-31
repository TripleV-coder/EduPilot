"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading, PageError } from "@/components/layout/page-states";
import { Badge, Button, Card, Icon } from "@/components/edu";
import { STAFF_MEMBER_ROLES } from "@/lib/staff/hr";
import { formatUserRoleLabel } from "@/lib/utils/role-label";

type LeaveType = "SICK" | "ANNUAL" | "MATERNITY" | "EXCEPTIONAL" | "UNPAID";
type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

interface LeaveRow {
    id: string;
    name: string;
    role: string;
    type: LeaveType;
    startDate: string;
    endDate: string;
    days: number;
    reason: string | null;
    status: LeaveStatus;
    decidedBy: string | null;
    decisionNote: string | null;
    isMine: boolean;
}
interface LeavesResponse {
    canManage: boolean;
    requests: LeaveRow[];
}

const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
    { value: "ANNUAL", label: "Congé annuel" },
    { value: "SICK", label: "Maladie" },
    { value: "MATERNITY", label: "Maternité / paternité" },
    { value: "EXCEPTIONAL", label: "Exceptionnel" },
    { value: "UNPAID", label: "Sans solde" },
];
const TYPE_LABEL = Object.fromEntries(LEAVE_TYPES.map((t) => [t.value, t.label])) as Record<LeaveType, string>;

const STATUS_META: Record<LeaveStatus, { label: string; variant: "warning" | "success" | "danger" | "neutral" }> = {
    PENDING: { label: "En attente", variant: "warning" },
    APPROVED: { label: "Approuvé", variant: "success" },
    REJECTED: { label: "Refusé", variant: "danger" },
    CANCELLED: { label: "Annulé", variant: "neutral" },
};

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function LeavesContent() {
    const { data, error, isLoading, mutate } = useSWR<LeavesResponse>("/api/staff/leaves", fetcher);

    const [type, setType] = useState<LeaveType>("ANNUAL");
    const [startDate, setStartDate] = useState(today());
    const [endDate, setEndDate] = useState(today());
    const [reason, setReason] = useState("");
    const [submitting, setSubmitting] = useState(false);

    async function submitRequest(e: React.FormEvent) {
        e.preventDefault();
        if (endDate < startDate) {
            toast.error("La date de fin ne peut pas précéder la date de début.");
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch("/api/staff/leaves", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, startDate, endDate, reason: reason || null }),
            });
            if (!res.ok) throw new Error();
            toast.success("Demande de congé envoyée.");
            setReason("");
            await mutate();
        } catch {
            toast.error("Échec de l'envoi de la demande.");
        } finally {
            setSubmitting(false);
        }
    }

    async function decide(id: string, action: "approve" | "reject" | "cancel") {
        try {
            const res = await fetch(`/api/staff/leaves/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            if (!res.ok) throw new Error();
            await mutate();
        } catch {
            toast.error("Action impossible.");
        }
    }

    if (isLoading) return <PageLoading label="Chargement des congés…" />;
    if (error) return <PageError message="Impossible de charger les demandes de congé." />;
    if (!data) return null;

    const { canManage, requests } = data;
    const pending = requests.filter((r) => r.status === "PENDING");

    return (
        <div className="space-y-5">
            {/* Formulaire de demande */}
            <Card padding={0}>
                <div className="flex items-center gap-2 border-b px-5 py-4" style={{ borderColor: "var(--eduflow-border-subtle)" }}>
                    <Icon name="calendar" size={18} color="var(--brand-700)" />
                    <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>Demander un congé</h3>
                </div>
                <form onSubmit={submitRequest} className="grid gap-3 px-5 py-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                    <label className="flex flex-col gap-1">
                        <span style={labelStyle}>Type</span>
                        <select value={type} onChange={(e) => setType(e.target.value as LeaveType)} style={selectStyle}>
                            {LEAVE_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1">
                        <span style={labelStyle}>Du</span>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={selectStyle} />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span style={labelStyle}>Au</span>
                        <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} style={selectStyle} />
                    </label>
                    <label className="flex flex-col gap-1" style={{ gridColumn: "1 / -1" }}>
                        <span style={labelStyle}>Motif (optionnel)</span>
                        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} placeholder="Ex : événement familial" style={selectStyle} />
                    </label>
                    <div style={{ gridColumn: "1 / -1" }}>
                        <Button type="submit" icon="check" loading={submitting}>Envoyer la demande</Button>
                    </div>
                </form>
            </Card>

            {/* File d'attente (gestionnaire) */}
            {canManage && pending.length > 0 ? (
                <Card padding={0}>
                    <div className="border-b px-5 py-4" style={{ borderColor: "var(--eduflow-border-subtle)" }}>
                        <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                            À valider ({pending.length})
                        </h3>
                    </div>
                    <ul className="divide-y" style={{ borderColor: "var(--eduflow-border-subtle)" }}>
                        {pending.map((r) => (
                            <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                                <div className="min-w-0 flex-1">
                                    <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name} · <span style={{ color: "var(--eduflow-text-tertiary)", fontWeight: 400 }}>{formatUserRoleLabel(r.role)}</span></div>
                                    <div style={{ fontSize: 12, color: "var(--eduflow-text-secondary)" }}>
                                        {TYPE_LABEL[r.type]} · {r.startDate} → {r.endDate} ({r.days} j){r.reason ? ` · ${r.reason}` : ""}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="secondary" size="sm" icon="check" onClick={() => decide(r.id, "approve")}>Approuver</Button>
                                    <Button variant="danger" size="sm" icon="x" onClick={() => decide(r.id, "reject")}>Refuser</Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </Card>
            ) : null}

            {/* Historique complet */}
            <Card padding={0}>
                <div className="border-b px-5 py-4" style={{ borderColor: "var(--eduflow-border-subtle)" }}>
                    <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                        {canManage ? "Toutes les demandes" : "Mes demandes"}
                    </h3>
                </div>
                {requests.length === 0 ? (
                    <p className="px-5 py-8 text-center" style={{ fontSize: 13, color: "var(--eduflow-text-tertiary)" }}>
                        Aucune demande de congé pour le moment.
                    </p>
                ) : (
                    <ul className="divide-y" style={{ borderColor: "var(--eduflow-border-subtle)" }}>
                        {requests.map((r) => (
                            <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                                <div className="min-w-0 flex-1">
                                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                                        {canManage ? r.name : TYPE_LABEL[r.type]}
                                        {canManage ? <span style={{ color: "var(--eduflow-text-tertiary)", fontWeight: 400 }}> · {TYPE_LABEL[r.type]}</span> : null}
                                    </div>
                                    <div style={{ fontSize: 12, color: "var(--eduflow-text-secondary)" }}>
                                        {r.startDate} → {r.endDate} ({r.days} j)
                                        {r.decidedBy ? ` · décidé par ${r.decidedBy}` : ""}
                                    </div>
                                </div>
                                <Badge variant={STATUS_META[r.status].variant} size="sm">{STATUS_META[r.status].label}</Badge>
                                {r.status === "PENDING" && r.isMine ? (
                                    <Button variant="ghost" size="sm" onClick={() => decide(r.id, "cancel")}>Annuler</Button>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
}

const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "var(--eduflow-text-tertiary)",
};
const selectStyle: React.CSSProperties = {
    height: 40,
    padding: "0 12px",
    borderRadius: "var(--eduflow-radius-input)",
    border: "1px solid var(--eduflow-border-default)",
    background: "var(--eduflow-surface-card)",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 500,
    color: "var(--eduflow-text-primary)",
};

export default function StaffLeavesPage() {
    return (
        <PageGuard roles={[...STAFF_MEMBER_ROLES]}>
            <PageShell className="max-w-4xl pb-12">
                <PageHeader
                    title="Congés"
                    description="Dépose tes demandes de congé et suis leur validation."
                    breadcrumbs={[
                        { label: "Personnel", href: "/dashboard/staff" },
                        { label: "Congés" },
                    ]}
                />
                <LeavesContent />
            </PageShell>
        </PageGuard>
    );
}
