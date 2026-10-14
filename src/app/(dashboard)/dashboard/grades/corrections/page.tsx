"use client";

/**
 * Réclamations de notes après conseil de classe :
 *   - l'enseignant de la matière enregistre la correction décidée en personne ;
 *   - le directeur des études l'approuve (la note est alors modifiée et
 *     historisée) ou la refuse.
 */
import { useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";

import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { Badge, Button, Card, Icon } from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageError } from "@/components/layout/page-states";
import { formatDecimal } from "@/lib/utils/formatters";

type Status = "PENDING" | "APPROVED" | "REJECTED";
type GradeState = { value: number | null; isAbsent: boolean; isExcused: boolean };

interface CorrectionRow {
    id: string;
    status: Status;
    reason: string;
    reviewNote: string | null;
    reviewedAt: string | null;
    createdAt: string;
    student: { id: string; name: string };
    evaluation: { id: string; label: string; date: string; maxGrade: number; period: string; className: string; subject: string };
    current: GradeState | null;
    proposed: GradeState & { excuseReason: string | null };
}

interface TeacherSubject {
    id: string;
    classId: string;
    subject: { name: string };
    class: { name: string };
}

interface CahierData {
    students: Array<{ id: string; firstName: string; lastName: string }>;
    evaluations: Array<{
        id: string;
        title: string | null;
        date: string;
        maxGrade: number;
        type: string;
        period: string;
        grades: Record<string, GradeState | undefined>;
    }>;
}

const DECIDER_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
const STATUS_LABEL: Record<Status, string> = { PENDING: "En attente", APPROVED: "Approuvée", REJECTED: "Refusée" };
const STATUS_VARIANT: Record<Status, "warning" | "success" | "danger"> = { PENDING: "warning", APPROVED: "success", REJECTED: "danger" };

function describe(g: GradeState | null, max?: number): string {
    if (!g) return "pas de note";
    if (g.isAbsent) return g.isExcused ? "absence justifiée" : "absence non justifiée";
    if (g.value === null) return "NC";
    return `${formatDecimal(g.value, 2)}${max ? ` / ${formatDecimal(max, 0)}` : ""}`;
}

async function readError(res: Response, fallback: string): Promise<string> {
    const body = await res.json().catch(() => null);
    return (body && typeof body.error === "string" && body.error) || fallback;
}

export default function GradeCorrectionsPage() {
    const { data: session } = useSession();
    const role = session?.user?.role ?? "";
    const isTeacher = role === "TEACHER";
    const canDecide = DECIDER_ROLES.includes(role);

    const [filter, setFilter] = useState<Status | "ALL">("PENDING");
    const listKey = `/api/grades/corrections${filter === "ALL" ? "" : `?status=${filter}`}`;
    const { data, error, isLoading, mutate } = useSWR<{ data: CorrectionRow[] }>(listKey, fetcher);

    return (
        <PageGuard roles={["SUPER_ADMIN", "NETWORK_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}>
            <PageShell className="max-w-5xl pb-12">
                <PageHeader
                    title="Réclamations de notes"
                    description="Après le conseil de classe, les notes sont figées. Une correction décidée en personne (copie revue avec l'enseignant et le directeur des études) s'enregistre ici, puis le directeur des études la valide."
                    breadcrumbs={[{ label: "Notes", href: "/dashboard/grades" }, { label: "Réclamations" }]}
                />

                {isTeacher ? <ProposalForm onCreated={() => void mutate()} /> : null}

                <Card padding={0}>
                    <div
                        className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"
                        style={{ borderColor: "var(--eduflow-border-subtle)" }}
                    >
                        <h2 className="eduflow-display" style={{ fontSize: 16, margin: 0 }}>
                            {isTeacher ? "Mes demandes de correction" : "Corrections à valider"}
                        </h2>
                        <div className="flex flex-wrap gap-2" aria-label="Filtrer par statut">
                            {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((s) => (
                                <Button
                                    key={s}
                                    size="sm"
                                    variant={filter === s ? "primary" : "secondary"}
                                    aria-pressed={filter === s}
                                    onClick={() => setFilter(s)}
                                >
                                    {s === "ALL" ? "Toutes" : STATUS_LABEL[s]}
                                </Button>
                            ))}
                        </div>
                    </div>
                    <div className="grid gap-3 px-5 py-5">
                        {error ? <PageError message="Impossible de charger les réclamations." onRetry={() => void mutate()} /> : null}
                        {isLoading ? <p style={{ margin: 0, fontSize: 13 }}>Chargement…</p> : null}
                        {data && data.data.length === 0 ? (
                            <p style={{ margin: 0, fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                                {filter === "ALL" ? "Aucune réclamation." : `Aucune réclamation ${STATUS_LABEL[filter].toLowerCase()}.`}
                            </p>
                        ) : null}
                        {data?.data.map((row) => (
                            <CorrectionCard key={row.id} row={row} canDecide={canDecide} onDecided={() => void mutate()} />
                        ))}
                    </div>
                </Card>
            </PageShell>
        </PageGuard>
    );
}

function CorrectionCard({ row, canDecide, onDecided }: { row: CorrectionRow; canDecide: boolean; onDecided: () => void }) {
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState<"APPROVE" | "REJECT" | null>(null);
    const [err, setErr] = useState<string | null>(null);

    const decide = async (decision: "APPROVE" | "REJECT") => {
        if (decision === "REJECT" && !note.trim()) {
            setErr("Indiquez la raison du refus.");
            return;
        }
        setBusy(decision);
        setErr(null);
        try {
            const res = await fetch(`/api/grades/corrections/${row.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ decision, reviewNote: note.trim() || undefined }),
            });
            if (!res.ok) throw new Error(await readError(res, "Décision impossible"));
            onDecided();
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Décision impossible");
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="grid gap-2 rounded-lg border px-4 py-3" style={{ borderColor: "var(--eduflow-border-subtle)" }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <strong style={{ fontSize: 14 }}>{row.student.name}</strong>
                <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--eduflow-text-secondary)" }}>
                {row.evaluation.className} · {row.evaluation.subject} · {row.evaluation.label} du{" "}
                {new Date(row.evaluation.date).toLocaleDateString("fr-FR")} · {row.evaluation.period}
            </p>
            <p style={{ margin: 0, fontSize: 13 }}>
                Note actuelle : <strong>{describe(row.current, row.evaluation.maxGrade)}</strong> → correction proposée :{" "}
                <strong>{describe(row.proposed, row.evaluation.maxGrade)}</strong>
                {row.proposed.excuseReason ? ` (motif : ${row.proposed.excuseReason})` : ""}
            </p>
            <p style={{ margin: 0, fontSize: 12 }}>Motif : {row.reason}</p>
            {row.reviewNote ? (
                <p style={{ margin: 0, fontSize: 12, color: "var(--eduflow-text-secondary)" }}>Réponse : {row.reviewNote}</p>
            ) : null}
            {canDecide && row.status === "PENDING" ? (
                <div className="flex flex-wrap items-end gap-2">
                    <label className="block" style={{ flex: "1 1 220px" }}>
                        <span style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                            Commentaire (obligatoire pour refuser)
                        </span>
                        <input
                            value={note}
                            maxLength={1000}
                            onChange={(e) => setNote(e.target.value)}
                            style={{
                                width: "100%",
                                height: 34,
                                padding: "0 10px",
                                borderRadius: 8,
                                border: "1px solid var(--eduflow-border-default)",
                                fontSize: 13,
                            }}
                        />
                    </label>
                    <Button size="sm" icon="check" loading={busy === "APPROVE"} disabled={busy !== null} onClick={() => decide("APPROVE")}>
                        Approuver
                    </Button>
                    <Button size="sm" variant="danger" icon="x" loading={busy === "REJECT"} disabled={busy !== null} onClick={() => decide("REJECT")}>
                        Refuser
                    </Button>
                </div>
            ) : null}
            {err ? (
                <p role="alert" style={{ margin: 0, fontSize: 12, color: "var(--eduflow-danger-600)" }}>
                    {err}
                </p>
            ) : null}
        </div>
    );
}

function ProposalForm({ onCreated }: { onCreated: () => void }) {
    const { data: subjects } = useSWR<TeacherSubject[]>("/api/me/subjects", fetcher);
    const [subjectId, setSubjectId] = useState("");
    const selected = subjects?.find((s) => s.id === subjectId);
    const { data: cahier } = useSWR<CahierData>(
        selected ? `/api/grades/cahier?classId=${selected.classId}&classSubjectId=${selected.id}` : null,
        fetcher
    );
    const [evaluationId, setEvaluationId] = useState("");
    const [studentId, setStudentId] = useState("");
    const [value, setValue] = useState("");
    const [absent, setAbsent] = useState(false);
    const [excused, setExcused] = useState(false);
    const [excuseReason, setExcuseReason] = useState("");
    const [reason, setReason] = useState("");
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    const evaluation = cahier?.evaluations.find((e) => e.id === evaluationId);
    const current = evaluation && studentId ? evaluation.grades[studentId] ?? null : null;
    const students = useMemo(
        () =>
            [...(cahier?.students ?? [])].sort((a, b) =>
                `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
            ),
        [cahier]
    );

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        if (!evaluationId || !studentId) {
            setMessage({ ok: false, text: "Choisissez l'évaluation et l'élève." });
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/grades/corrections", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    evaluationId,
                    studentId,
                    proposedValue: absent ? null : value === "" ? null : Number(value),
                    proposedAbsent: absent,
                    proposedExcused: absent && excused,
                    excuseReason: absent && excused ? excuseReason : undefined,
                    reason,
                }),
            });
            if (!res.ok) throw new Error(await readError(res, "Enregistrement impossible"));
            setMessage({ ok: true, text: "Correction enregistrée : elle attend la validation du directeur des études." });
            setStudentId("");
            setValue("");
            setAbsent(false);
            setExcused(false);
            setExcuseReason("");
            setReason("");
            onCreated();
        } catch (err) {
            setMessage({ ok: false, text: err instanceof Error ? err.message : "Enregistrement impossible" });
        } finally {
            setSaving(false);
        }
    };

    const field: React.CSSProperties = {
        width: "100%",
        height: 38,
        padding: "0 10px",
        borderRadius: 8,
        border: "1px solid var(--eduflow-border-default)",
        background: "var(--eduflow-surface-card)",
        fontSize: 13,
    };
    const label: React.CSSProperties = {
        display: "block",
        fontSize: 11,
        fontWeight: 600,
        marginBottom: 4,
        color: "var(--eduflow-text-tertiary)",
    };

    return (
        <Card padding={0}>
            <div className="flex items-center gap-2 border-b px-5 py-4" style={{ borderColor: "var(--eduflow-border-subtle)" }}>
                <Icon name="pencil" size={18} color="var(--brand-700)" />
                <h2 className="eduflow-display" style={{ fontSize: 16, margin: 0 }}>
                    Enregistrer une correction
                </h2>
            </div>
            <form
                onSubmit={submit}
                className="grid gap-3 px-5 py-5"
                style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))" }}
            >
                <label>
                    <span style={label}>Classe et matière</span>
                    <select
                        style={field}
                        value={subjectId}
                        onChange={(e) => {
                            setSubjectId(e.target.value);
                            setEvaluationId("");
                            setStudentId("");
                        }}
                    >
                        <option value="">Choisir…</option>
                        {(subjects ?? []).map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.class.name} · {s.subject.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    <span style={label}>Évaluation</span>
                    <select style={field} value={evaluationId} disabled={!cahier} onChange={(e) => setEvaluationId(e.target.value)}>
                        <option value="">Choisir…</option>
                        {(cahier?.evaluations ?? []).map((ev) => (
                            <option key={ev.id} value={ev.id}>
                                {ev.period} · {ev.title || ev.type} · {new Date(ev.date).toLocaleDateString("fr-FR")}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    <span style={label}>Élève</span>
                    <select style={field} value={studentId} disabled={!evaluation} onChange={(e) => setStudentId(e.target.value)}>
                        <option value="">Choisir…</option>
                        {students.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.lastName} {s.firstName}
                            </option>
                        ))}
                    </select>
                </label>
                {evaluation && studentId ? (
                    <p style={{ margin: 0, fontSize: 13, alignSelf: "end" }}>
                        Note actuelle : <strong>{describe(current, evaluation.maxGrade)}</strong>
                    </p>
                ) : null}
                <label>
                    <span style={label}>Nouvelle note{evaluation ? ` (sur ${evaluation.maxGrade})` : ""}</span>
                    <input
                        style={field}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={evaluation?.maxGrade}
                        step="0.01"
                        value={value}
                        disabled={absent}
                        onChange={(e) => setValue(e.target.value)}
                    />
                </label>
                <div className="grid gap-1" style={{ alignSelf: "end", fontSize: 13 }}>
                    <label className="inline-flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={absent}
                            onChange={(e) => {
                                setAbsent(e.target.checked);
                                if (!e.target.checked) setExcused(false);
                            }}
                        />
                        Absence à l&apos;évaluation
                    </label>
                    {absent ? (
                        <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={excused} onChange={(e) => setExcused(e.target.checked)} />
                            Absence justifiée
                        </label>
                    ) : null}
                </div>
                {absent && excused ? (
                    <label>
                        <span style={label}>Motif de l&apos;absence</span>
                        <input style={field} value={excuseReason} maxLength={300} onChange={(e) => setExcuseReason(e.target.value)} />
                    </label>
                ) : null}
                <label style={{ gridColumn: "1 / -1" }}>
                    <span style={label}>Motif de la correction (décidée lors du rendez-vous)</span>
                    <textarea
                        value={reason}
                        maxLength={1000}
                        rows={2}
                        onChange={(e) => setReason(e.target.value)}
                        style={{ ...field, height: "auto", padding: "8px 10px" }}
                    />
                </label>
                <div className="flex flex-wrap items-center gap-3" style={{ gridColumn: "1 / -1" }}>
                    <Button type="submit" icon={saving ? undefined : "check"} loading={saving}>
                        Envoyer au directeur des études
                    </Button>
                    {message ? (
                        <span
                            role="status"
                            style={{ fontSize: 12, color: message.ok ? "var(--eduflow-text-secondary)" : "var(--eduflow-danger-600)" }}
                        >
                            {message.text}
                        </span>
                    ) : null}
                </div>
            </form>
        </Card>
    );
}
