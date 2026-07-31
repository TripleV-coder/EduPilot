"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading, PageError } from "@/components/layout/page-states";
import { Avatar, Button, Card, Icon, MetricCard, type IconName } from "@/components/edu";
import { STAFF_MEMBER_ROLES } from "@/lib/staff/hr";
import { formatUserRoleLabel } from "@/lib/utils/role-label";

type Status = "PRESENT" | "ABSENT" | "LATE" | "ON_LEAVE";

interface RosterRow {
    userId: string;
    name: string;
    role: string;
    status: Status | null;
    checkIn: string | null;
    checkOut: string | null;
    note: string | null;
}
interface AttendanceResponse {
    date: string;
    canManage: boolean;
    summary: { present: number; absent: number; late: number; onLeave: number; total: number };
    roster: RosterRow[];
}

const STATUS_META: Record<Status, { label: string; short: string; color: string; icon: IconName }> = {
    PRESENT: { label: "Présent", short: "P", color: "var(--eduflow-success-600)", icon: "success" },
    LATE: { label: "Retard", short: "R", color: "var(--eduflow-warning-600)", icon: "clock" },
    ABSENT: { label: "Absent", short: "A", color: "var(--eduflow-danger-600)", icon: "x" },
    ON_LEAVE: { label: "Congé", short: "C", color: "var(--eduflow-accent-600)", icon: "calendar" },
};
const STATUSES: Status[] = ["PRESENT", "LATE", "ABSENT", "ON_LEAVE"];

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function AttendanceContent() {
    const [date, setDate] = useState(today());
    const { data, error, isLoading, mutate } = useSWR<AttendanceResponse>(
        `/api/staff/attendance?date=${date}`,
        fetcher,
    );
    const [savingId, setSavingId] = useState<string | null>(null);

    async function setStatus(userId: string, status: Status) {
        setSavingId(userId);
        // Optimiste : reflète immédiatement le nouveau statut.
        mutate(
            (curr) =>
                curr
                    ? { ...curr, roster: curr.roster.map((r) => (r.userId === userId ? { ...r, status } : r)) }
                    : curr,
            false,
        );
        try {
            const res = await fetch("/api/staff/attendance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, date, status }),
            });
            if (!res.ok) throw new Error();
            await mutate();
        } catch {
            toast.error("Échec de l'enregistrement du pointage.");
            await mutate();
        } finally {
            setSavingId(null);
        }
    }

    async function markAllPresent() {
        if (!data) return;
        const entries = data.roster.map((r) => ({ userId: r.userId, status: "PRESENT" as const }));
        try {
            const res = await fetch("/api/staff/attendance/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date, entries }),
            });
            if (!res.ok) throw new Error();
            const json = await res.json();
            toast.success(`${json.saved} agents pointés présents.`);
            await mutate();
        } catch {
            toast.error("Échec du pointage groupé.");
        }
    }

    if (isLoading) return <PageLoading label="Chargement de la présence…" />;
    if (error) return <PageError message="Impossible de charger la présence du personnel." />;
    if (!data) return null;

    const { summary, canManage, roster } = data;

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <label className="flex flex-col gap-1">
                    <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--eduflow-text-tertiary)" }}>
                        Date
                    </span>
                    <input
                        type="date"
                        value={date}
                        max={today()}
                        onChange={(e) => setDate(e.target.value)}
                        style={{
                            height: 40,
                            padding: "0 12px",
                            borderRadius: "var(--eduflow-radius-input)",
                            border: "1px solid var(--eduflow-border-default)",
                            background: "var(--eduflow-surface-card)",
                            fontFamily: "inherit",
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--eduflow-text-primary)",
                        }}
                    />
                </label>
                {canManage ? (
                    <Button variant="secondary" icon="success" onClick={markAllPresent} disabled={roster.length === 0}>
                        Tout présent
                    </Button>
                ) : null}
            </div>

            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                <MetricCard label="Effectif" value={String(summary.total)} icon="users" />
                <MetricCard label="Présents" value={String(summary.present)} icon="success" variant="success" />
                <MetricCard label="Retards" value={String(summary.late)} icon="clock" variant="warning" />
                <MetricCard label="Absents" value={String(summary.absent)} icon="x" variant="danger" />
                <MetricCard label="Congés" value={String(summary.onLeave)} icon="calendar" />
            </div>

            <Card padding={0}>
                {roster.length === 0 ? (
                    <p className="px-5 py-8 text-center" style={{ fontSize: 13, color: "var(--eduflow-text-tertiary)" }}>
                        Aucun membre du personnel actif.
                    </p>
                ) : (
                    <ul className="divide-y" style={{ borderColor: "var(--eduflow-border-subtle)" }}>
                        {roster.map((row) => (
                            <li key={row.userId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                                <Avatar name={row.name} size="sm" />
                                <div className="min-w-0 flex-1">
                                    <div style={{ fontSize: 14, fontWeight: 600 }}>{row.name}</div>
                                    <div style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>
                                        {formatUserRoleLabel(row.role)}
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    {STATUSES.map((s) => {
                                        const active = row.status === s;
                                        const meta = STATUS_META[s];
                                        return (
                                            <button
                                                key={s}
                                                type="button"
                                                disabled={!canManage || savingId === row.userId}
                                                onClick={() => setStatus(row.userId, s)}
                                                aria-pressed={active}
                                                title={meta.label}
                                                className="grid place-items-center transition-colors"
                                                style={{
                                                    width: 34,
                                                    height: 34,
                                                    borderRadius: 8,
                                                    border: active ? `2px solid ${meta.color}` : "1px solid var(--eduflow-border-default)",
                                                    background: active ? meta.color : "var(--eduflow-surface-card)",
                                                    color: active ? "#fff" : "var(--eduflow-text-secondary)",
                                                    cursor: canManage ? "pointer" : "default",
                                                    opacity: !canManage && !active ? 0.4 : 1,
                                                }}
                                            >
                                                <Icon name={meta.icon} size={15} />
                                            </button>
                                        );
                                    })}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            {!canManage ? (
                <p style={{ fontSize: 12, color: "var(--eduflow-text-tertiary)" }}>
                    Seule ta présence est affichée. La saisie est réservée à la direction.
                </p>
            ) : null}
        </div>
    );
}

export default function StaffAttendancePage() {
    return (
        <PageGuard roles={[...STAFF_MEMBER_ROLES]}>
            <PageShell className="max-w-5xl pb-12">
                <PageHeader
                    title="Présence du personnel"
                    description="Pointe le personnel au quotidien : présents, retards, absents, congés."
                    breadcrumbs={[
                        { label: "Personnel", href: "/dashboard/staff" },
                        { label: "Présence" },
                    ]}
                />
                <AttendanceContent />
            </PageShell>
        </PageGuard>
    );
}
